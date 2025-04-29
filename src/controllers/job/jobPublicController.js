const Job = require("../../models/job/Job");
const renderProfile = require("../../utils/renderProfile");

exports.getJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ _id: jobId, isDeleted: false })
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    let jobProfile;
    try {
      jobProfile = renderProfile(job, "job");
    } catch (error) {
      console.error("Error rendering job profile:", error);
      jobProfile = {
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
      };
    }

    res.status(200).json({
      message: "Job retrieved successfully",
      job: jobProfile,
    });
  } catch (error) {
    console.error("Error in getJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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

    const jobProfiles = jobs.map((job) => {
      try {
        return renderProfile(job, "job");
      } catch (error) {
        console.error("Error rendering job profile:", error);
        return {
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
        };
      }
    });

    res.status(200).json({
      message: "Jobs retrieved successfully",
      jobs: jobProfiles,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error in getJobs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCompanyJobs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const company = await Company.findOne({ _id: companyId, isDeleted: false });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const query = { companyId, status: "Open", isDeleted: false };
    const jobs = await Job.find(query)
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    const jobProfiles = jobs.map((job) => {
      try {
        return renderProfile(job, "job");
      } catch (error) {
        console.error("Error rendering job profile:", error);
        return {
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
        };
      }
    });

    res.status(200).json({
      message: "Company jobs retrieved successfully",
      jobs: jobProfiles,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error in getCompanyJobs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};