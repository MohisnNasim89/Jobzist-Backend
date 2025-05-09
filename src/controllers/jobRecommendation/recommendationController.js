const Job = require("../models/job/Job");
const JobSeeker = require("../models/user/JobSeeker");
const { checkJobSeekerExists } = require("../utils/checks");
const axios = require("axios");

const calculateExperienceYears = (experience) => {
  if (!experience || experience.length === 0) return 0;
  let totalMonths = 0;
  experience.forEach((exp) => {
    const start = new Date(exp.startDate);
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    const months = (end - start) / (1000 * 60 * 60 * 24 * 30);
    totalMonths += months;
  });
  return Math.floor(totalMonths / 12);
};

const mapExperienceToLevel = (years) => {
  if (years <= 2) return "Entry-Level";
  if (years <= 5) return "Mid-Level";
  return "Senior-Level";
};

const fetchSynonyms = async (skill) => {
  try {
    const response = await axios.get(`https://api.datamuse.com/words?ml=${encodeURIComponent(skill)}&max=5`);
    return response.data.map((item) => item.word.toLowerCase());
  } catch (error) {
    console.error(`Error fetching synonyms for ${skill}:`, error.message);
    return [];
  }
};

const preprocessSkills = async (skills) => {
  const processed = new Set([skills.map((s) => s.toLowerCase()).flat()]);

  for (const skill of skills) {
    const synonyms = await fetchSynonyms(skill);
    synonyms.forEach((syn) => processed.add(syn));
  }

  return Array.from(processed);
};

const calculateMatchScore = async (job, jobSeeker) => {
  let score = 0;

  const seekerSkillsProcessed = await preprocessSkills(jobSeeker.skills || []);
  const jobSkillsProcessed = await preprocessSkills(job.skills || []);
  const matchingSkills = jobSkillsProcessed.filter((skill) =>
    seekerSkillsProcessed.includes(skill)
  );
  score += (matchingSkills.length / Math.max(jobSkillsProcessed.length, 1)) * 40;

  if (
    jobSeeker.jobPreferences?.location &&
    job.location.city.toLowerCase() === jobSeeker.jobPreferences.location.toLowerCase()
  ) {
    score += 20;
  }

  if (
    jobSeeker.jobPreferences?.jobType &&
    jobSeeker.jobPreferences.jobType.includes(job.jobType)
  ) {
    score += 20;
  }

  const experienceYears = calculateExperienceYears(jobSeeker.experience);
  const seekerLevel = mapExperienceToLevel(experienceYears);
  if (seekerLevel === job.experienceLevel) {
    score += 10;
  }

  if (
    jobSeeker.jobPreferences?.salaryExpectation &&
    job.salary.max >= jobSeeker.jobPreferences.salaryExpectation
  ) {
    score += 10;
  }

  return score;
};

exports.getJobRecommendations = async (req, res) => {
  try {
    const { userId } = req.user;
    const jobSeeker = await checkJobSeekerExists(userId);

    const jobs = await Job.find({ status: "Open", isDeleted: false })
      .populate("companyId", "name logo")
      .lean();

    const recommendations = await Promise.all(
      jobs.map(async (job) => ({
        job,
        score: await calculateMatchScore(job, jobSeeker),
      }))
    )
      .then((results) =>
        results
          .filter((rec) => rec.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((rec) => rec.job)
      );

    res.status(200).json({ recommendations });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while fetching job recommendations",
    });
  }
};