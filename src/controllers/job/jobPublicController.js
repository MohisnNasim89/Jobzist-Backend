const Job = require("../../models/job/Job");
const { checkJobExists, checkCompanyExists, renderProfileWithFallback } = require("../../utils/checks");

exports.getJob = async (req, res) => {
  const { jobId } = req.params;

  const job = await checkJobExists(jobId)
    .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
    .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } });

  const jobProfile = renderProfileWithFallback(job, "job", {
    _id: job._id,
    title: job.title,
    company: job.companyId ? { _id: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
    postedBy: job.postedBy?.profileId?.fullName || "Unknown",
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
  });

  res.status(200).json({
    message: "Job retrieved successfully",
    job: jobProfile,
  });
};

exports.getJobs = async (req, res) => {
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
    .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
    .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(query);

  const jobProfiles = jobs.map((job) =>
    renderProfileWithFallback(job, "job", {
      _id: job._id,
      title: job.title,
      company: job.companyId ? { _id: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
      postedBy: job.postedBy?.profileId?.fullName || "Unknown",
      location: job.location,
      jobType: job.jobType,
      salary: job.salary,
      experienceLevel: job.experienceLevel,
      applicationDeadline: job.applicationDeadline,
      status: job.status,
      createdAt: job.createdAt,
    })
  );

  res.status(200).json({
    message: "Jobs retrieved successfully",
    jobs: jobProfiles,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
};

exports.getCompanyJobs = async (req, res) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  await checkCompanyExists(companyId);

  const query = { companyId, status: "Open", isDeleted: false };
  const jobs = await Job.find(query)
    .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
    .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Job.countDocuments(query);

  const jobProfiles = jobs.map((job) =>
    renderProfileWithFallback(job, "job", {
      _id: job._id,
      title: job.title,
      company: job.companyId ? { _id: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
      postedBy: job.postedBy?.profileId?.fullName || "Unknown",
      location: job.location,
      jobType: job.jobType,
      salary: job.salary,
      experienceLevel: job.experienceLevel,
      applicationDeadline: job.applicationDeadline,
      status: job.status,
      createdAt: job.createdAt,
    })
  );

  res.status(200).json({
    message: "Company jobs retrieved successfully",
    jobs: jobProfiles,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
  });
};