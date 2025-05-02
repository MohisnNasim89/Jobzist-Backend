const Job = require("../../models/job/Job");
const { checkJobExists, checkCompanyExists, renderProfileWithFallback } = require("../../utils/checks");

exports.getJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobQuery = checkJobExists(jobId);

    const job = await jobQuery
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } })
      .exec();

    if (!job) {
      const error = new Error("Job not found");
      error.status = 404;
      throw error;
    }

    let isCreator = false;
    if (req.user && req.user._id) {
      const userId = req.user._id.toString();
      const userRole = req.user.role;
      const jobCreatorId = job.postedBy._id.toString();
      const isEmployerOrAdmin = ["employer", "company_admin"].includes(userRole);
      isCreator = isEmployerOrAdmin && userId === jobCreatorId;
    }

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
    }, isCreator);

    res.status(200).json({
      message: "Job retrieved successfully",
      job: jobProfile,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the job",
    });
  }
};

exports.getJobs = async (req, res) => {
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
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    // Determine if the requesting user is an employer or company_admin
    const userId = req.user?._id?.toString();
    const userRole = req.user?.role;
    const isEmployerOrAdmin = userId && ["employer", "company_admin"].includes(userRole);

    const jobProfiles = jobs.map((job) => {
      // Check if the user is the creator of this specific job
      const jobCreatorId = job.postedBy._id.toString();
      const isCreator = isEmployerOrAdmin && userId === jobCreatorId;

      return renderProfileWithFallback(job, "job", {
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
      }, isCreator);
    });

    res.status(200).json({
      message: "Jobs retrieved successfully",
      jobs: jobProfiles,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving jobs",
    });
  }
};

exports.getCompanyJobs = async (req, res) => {
  try {
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

    const userId = req.user?._id?.toString();
    const userRole = req.user?.role;
    const isEmployerOrAdmin = userId && ["employer", "company_admin"].includes(userRole);

    const jobProfiles = jobs.map((job) => {
      const jobCreatorId = job.postedBy._id.toString();
      const isCreator = isEmployerOrAdmin && userId === jobCreatorId;

      return renderProfileWithFallback(job, "job", {
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
      }, isCreator);
    });

    res.status(200).json({
      message: "Company jobs retrieved successfully",
      jobs: jobProfiles,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving company jobs",
    });
  }
};