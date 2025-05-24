const Job = require("../../models/job/Job");
const JobSeeker = require("../../models/user/JobSeeker");
const { checkJobSeekerExists } = require("../../utils/checks");
const { fetchSynonyms } = require("../../utils/synonym");
const logger = require("../../utils/logger");

const calculateExperienceYears = (experience) => {
  if (!experience || experience.length === 0) return 0;
  return experience.reduce((acc, exp) => {
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    return acc + (end - start) / (1000 * 60 * 60 * 24 * 30);
  }, 0) / 12;
};

const mapExperienceToLevel = (years) => {
  if (years <= 2) return "Entry-Level";
  if (years <= 5) return "Mid-Level";
  return "Senior-Level";
};

const preprocessSkills = async (skills = []) => {
  const all = new Set(skills.map((s) => s.toLowerCase()));
  for (const skill of skills) {
    const synonyms = await fetchSynonyms(skill);
    synonyms.forEach((syn) => all.add(syn));
  }
  return Array.from(all);
};

const calculateMatchScore = async (job, jobSeeker) => {
  const seekerSkills = await preprocessSkills(jobSeeker.skills || []);
  const jobSkills = await preprocessSkills(job.skills || []);
  const matchCount = jobSkills.filter((skill) => seekerSkills.includes(skill)).length;
  let score = (matchCount / jobSkills.length) * 40;

  if (
    jobSeeker.jobPreferences?.location?.toLowerCase() === (job.location?.city?.toLowerCase() || "")
  ) score += 20;

  if (jobSeeker.jobPreferences?.jobType?.includes(job.jobType)) score += 20;

  const expYears = calculateExperienceYears(jobSeeker.experience);
  if (mapExperienceToLevel(expYears) === job.experienceLevel) score += 10;

  if (jobSeeker.jobPreferences?.salaryExpectation && job.salary?.max >= jobSeeker.jobPreferences.salaryExpectation) {
    score += 10;
  }

  return score;
};

exports.getJobRecommendations = async (req, res) => {
  try {
    const { userId } = req.user;
    const jobSeeker = await checkJobSeekerExists(userId)
      .select("skills jobPreferences experience")
      .lean();

    const jobs = await Job.find({ status: "Open", isDeleted: false })
      .select("_id title skills location jobType experienceLevel salary status isDeleted companyId")
      .populate("companyId", "name logo")
      .lean();

    const scores = await Promise.all(jobs.map(async (job) => ({
      job,
      score: await calculateMatchScore(job, jobSeeker)
    })));

    const recommendations = scores
      .filter((r) => r.score >= 50)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.job);

    res.status(200).json({ recommendations });
  } catch (error) {
    logger.error(`Error fetching job recommendations: ${error.message}`);
    res.status(error.status || 500).json({ 
      message: error.message 
    });
  }
};