const Job = require("../../models/job/Job");
const logger = require("../../utils/logger");
const { checkJobExists, checkCompanyExists } = require("../../utils/checks");

exports.getJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await checkJobExists(jobId)
      .select("_id title companyId postedBy description location jobType salary requirements skills experienceLevel applicationDeadline status createdAt")
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .lean();

    res.status(200).json({
      message: "Job retrieved successfully",
      job: {
        jobId: job._id,
        title: job.title,
        company: job.companyId ? { companyId: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
        description: job.description,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        requirements: job.requirements,
        skills: job.skills,
        experienceLevel: job.experienceLevel,
        applicationDeadline: job.applicationDeadline,
        status: job.status,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    logger.error(`Error retrieving job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the job",
    });
  }
};

exports.searchJobs = async (req, res) => {
  try {
    const { jobType, experienceLevel, location, page = 1, limit = 10 } = req.query;

    const query = { status: "Open", isDeleted: false };
    if (jobType) query.jobType = jobType;
    if (experienceLevel) query.experienceLevel = experienceLevel;
    if (location) {
      query.$or = [
        { "location.country": { $regex: location, $options: "i" } },
        { "location.city": { $regex: location, $options: "i" } },
      ];
    }

    const jobs = await Job.find(query)
      .select("_id title companyId status")
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Job.countDocuments(query);

    const jobList = jobs.map(job => ({
      jobId: job._id,
      title: job.title,
      company: job.companyId ? { companyId: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
      status: job.status,
    }));

    res.status(200).json({
      message: "Jobs retrieved successfully",
      jobs: jobList,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error retrieving jobs: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving jobs",
    });
  }
};

exports.getCompanyJobs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    await checkCompanyExists(companyId).lean();

    const query = { companyId, status: "Open", isDeleted: false };
    const jobs = await Job.find(query)
      .select("_id title companyId status")
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Job.countDocuments(query);

    const jobList = jobs.map(job => ({
      jobId: job._id,
      title: job.title,
      company: job.companyId ? { companyId: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
      status: job.status,
    }));

    res.status(200).json({
      message: "Company jobs retrieved successfully",
      jobs: jobList,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error retrieving company jobs: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving company jobs",
    });
  }
};