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
  if (!skills.length) return [];
  const allSkills = new Set(skills.map((s) => s.toLowerCase()));
  const synonymPromises = skills.map((skill) => fetchSynonyms(skill));
  const synonymResults = await Promise.all(synonymPromises);
  
  synonymResults.forEach((synonyms) => {
    synonyms.forEach((syn) => allSkills.add(syn));
  });
  
  return Array.from(allSkills);
};

const calculateMatchScore = async (job, jobSeeker) => {
  const seekerSkills = await preprocessSkills(jobSeeker.skills || []);
  const jobSkills = await preprocessSkills(job.skills || []);
  const matchCount = jobSkills.filter((skill) => seekerSkills.includes(skill)).length;
  let score = (matchCount / (jobSkills.length || 1)) * 40; // Avoid division by zero

  if (jobSeeker.jobPreferences?.location) {
    const seekerLocation = jobSeeker.jobPreferences.location.toLowerCase();
    const jobCity = job.location?.city?.toLowerCase() || "";
    const jobCountry = job.location?.country?.toLowerCase() || "";
    if (seekerLocation === jobCity || seekerLocation === jobCountry) {
      score += 20;
    }
  }

  if (jobSeeker.jobPreferences?.jobType?.includes(job.jobType)) score += 20;

  const expYears = calculateExperienceYears(jobSeeker.experience);
  if (mapExperienceToLevel(expYears) === job.experienceLevel) score += 10;

  if (
    jobSeeker.jobPreferences?.salaryExpectation &&
    job.salary?.max >= jobSeeker.jobPreferences.salaryExpectation
  ) {
    score += 10;
  }

  return score;
};

const processInBatches = async (items, batchSize, processFn) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
  }
  return results;
};

exports.getJobRecommendations = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;
    const jobSeeker = await checkJobSeekerExists(userId);

    const query = {
      status: "Open",
      isDeleted: false,
    };
    
    if (jobSeeker.jobPreferences?.jobType?.length) {
      query.jobType = { $in: jobSeeker.jobPreferences.jobType };
    }
    if (jobSeeker.jobPreferences?.location) {
      const location = jobSeeker.jobPreferences.location.toLowerCase();
      query.$or = [
        { "location.city": { $regex: location, $options: "i" } },
        { "location.country": { $regex: location, $options: "i" } },
      ];
    }

    const jobs = await Job.find(query)
      .select("_id title skills location jobType experienceLevel salary companyId")
      .populate("companyId", "name logo")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalJobs = await Job.countDocuments(query);

    const scores = await processInBatches(
      jobs,
      5,
      async (job) => ({
        job,
        score: await calculateMatchScore(job, jobSeeker),
      })
    );

    const recommendations = scores
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        _id: r.job._id,
        title: r.job.title,
        company: r.job.companyId ? {
          _id: r.job.companyId._id,
          name: r.job.companyId.name,
          logo: r.job.companyId.logo,
        } : null,
        location: r.job.location,
        jobType: r.job.jobType,
        experienceLevel: r.job.experienceLevel,
        salary: r.job.salary,
        matchScore: r.score,
      }));

    res.status(200).json({
      message: "Job recommendations retrieved successfully",
      recommendations,
      total: totalJobs,
      page: parseInt(page),
      pages: Math.ceil(totalJobs / limit),
    });
  } catch (error) {
    logger.error(`Error fetching job recommendations: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving job recommendations",
    });
  }
};