// src/controllers/jobController.js
const Job = require("../models/job/Job");
const User = require("../models/user/Users");
const Company = require("../models/company/Company");
const CompanyAdmin = require("../models/user/CompanyAdmin");

exports.createJob = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only Company Admins and Employers can create jobs
    if (user.role !== "company_admin" && user.role !== "employer") {
      return res.status(403).json({ message: "Unauthorized: Only company admins and employers can create jobs" });
    }

    let companyId;
    if (user.role === "company_admin") {
      const companyAdmin = await CompanyAdmin.findOne({ userId });
      if (!companyAdmin) {
        return res.status(404).json({ message: "Company admin profile not found" });
      }
      companyId = companyAdmin.companyId;
    } else if (user.role === "employer") {
      const Employer = require("../models/user/Employer");
      const employer = await Employer.findOne({ userId });
      if (!employer) {
        return res.status(404).json({ message: "Employer profile not found" });
      }

      // Handle based on employer roleType
      if (employer.roleType === "Company Employer") {
        if (!employer.companyId) {
          return res.status(400).json({ message: "Company Employer must be associated with a company" });
        }
        companyId = employer.companyId;
      } else if (employer.roleType === "Independent Recruiter") {
        // Independent Recruiters must provide a companyId in the request body
        if (!req.body.companyId) {
          return res.status(400).json({ message: "Company ID is required for Independent Recruiters" });
        }
        companyId = req.body.companyId;
      }
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const {
      title,
      description,
      location,
      jobType,
      salary,
      requirements,
      skills,
      experienceLevel,
      applicationDeadline,
      status,
    } = req.body;

    const job = new Job({
      title,
      companyId,
      postedBy: userId,
      description,
      location,
      jobType,
      salary,
      requirements,
      skills,
      experienceLevel,
      applicationDeadline,
      status: status || "Draft",
    });

    await job.save();

    // Add the job to the Company's jobListings
    company.jobListings.push({ jobId: job._id });
    await company.save();

    // Add the job to the Employer's jobListings if the user is an Employer
    if (user.role === "employer") {
      const Employer = require("../models/user/Employer");
      const employer = await Employer.findOne({ userId });
      if (employer) {
        employer.jobListings.push({ jobId: job._id });
        await employer.save();
      }
    }

    return res.status(200).json({
      message: "Job created successfully",
      job: {
        _id: job._id,
        title: job.title,
        companyId: job.companyId,
        postedBy: job.postedBy,
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
    console.error("Error in createJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;
    const updates = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Only the user who posted the job can update it
    if (job.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only update jobs you posted" });
    }

    const allowedUpdates = [
      "title",
      "description",
      "location",
      "jobType",
      "salary",
      "requirements",
      "skills",
      "experienceLevel",
      "applicationDeadline",
      "status",
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        job[key] = updates[key];
      }
    });

    await job.save();

    return res.status(200).json({
      message: "Job updated successfully",
      job: {
        _id: job._id,
        title: job.title,
        companyId: job.companyId,
        postedBy: job.postedBy,
        description: job.description,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        requirements: job.requirements,
        skills: job.skills,
        experienceLevel: job.experienceLevel,
        applicationDeadline: job.applicationDeadline,
        status: job.status,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error in updateJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Only the user who posted the job can delete it
    if (job.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only delete jobs you posted" });
    }

    // Remove the job from the Company's jobListings
    const company = await Company.findById(job.companyId);
    if (company) {
      company.jobListings = company.jobListings.filter(
        (listing) => listing.jobId.toString() !== jobId.toString()
      );
      await company.save();
    }

    // Remove the job from the Employer's jobListings if the user is an Employer
    if (req.user.role === "employer") {
      const Employer = require("../models/user/Employer");
      const employer = await Employer.findOne({ userId });
      if (employer) {
        employer.jobListings = employer.jobListings.filter(
          (listing) => listing.jobId.toString() !== jobId.toString()
        );
        await employer.save();
      }
    }

    await job.softDelete();

    return res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    console.error("Error in deleteJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const jobId = req.params.jobId;

    const job = await Job.findById(jobId)
      .populate("companyId", "profile.name profile.logo")
      .populate("postedBy", "fullName");
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json({
      message: "Job retrieved successfully",
      job: {
        _id: job._id,
        title: job.title,
        company: job.companyId,
        postedBy: job.postedBy,
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
    console.error("Error in getJobById:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const { jobType, location, experienceLevel, page = 1, limit = 10 } = req.query;

    const query = {};
    if (jobType) query.jobType = jobType;
    if (location) {
      query["location.city"] = location;
    }
    if (experienceLevel) query.experienceLevel = experienceLevel;
    query.status = "Open"; // Only show open jobs

    const jobs = await Job.find(query)
      .populate("companyId", "profile.name profile.logo")
      .populate("postedBy", "fullName")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(query);

    return res.status(200).json({
      message: "Jobs retrieved successfully",
      jobs: jobs.map((job) => ({
        _id: job._id,
        title: job.title,
        company: job.companyId,
        postedBy: job.postedBy,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        experienceLevel: job.experienceLevel,
        applicationDeadline: job.applicationDeadline,
        status: job.status,
        createdAt: job.createdAt,
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error in getAllJobs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.applyForJob = async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "job_seeker") {
      return res.status(403).json({ message: "Unauthorized: Only job seekers can apply for jobs" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.status !== "Open") {
      return res.status(400).json({ message: "This job is not open for applications" });
    }

    const jobSeeker = await require("../models/user/JobSeeker").findOne({ userId });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const alreadyApplied = job.applicants.some((applicant) => applicant.userId.toString() === userId.toString());
    if (alreadyApplied) {
      return res.status(400).json({ message: "You have already applied for this job" });
    }

    job.applicants.push({ userId });
    await job.save();

    jobSeeker.appliedJobs.push({ jobId });
    await jobSeeker.save();

    return res.status(200).json({ message: "Application submitted successfully" });
  } catch (error) {
    console.error("Error in applyForJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.saveJob = async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "job_seeker") {
      return res.status(403).json({ message: "Unauthorized: Only job seekers can save jobs" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const jobSeeker = await require("../models/user/JobSeeker").findOne({ userId });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const alreadySaved = jobSeeker.savedJobs.some((savedJob) => savedJob.jobId.toString() === jobId.toString());
    if (alreadySaved) {
      return res.status(400).json({ message: "You have already saved this job" });
    }

    jobSeeker.savedJobs.push({ jobId });
    await jobSeeker.save();

    return res.status(200).json({ message: "Job saved successfully" });
  } catch (error) {
    console.error("Error in saveJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "job_seeker") {
      return res.status(403).json({ message: "Unauthorized: Only job seekers can view saved jobs" });
    }

    const jobSeeker = await require("../models/user/JobSeeker")
      .findOne({ userId })
      .populate({
        path: "savedJobs.jobId",
        populate: [
          { path: "companyId", select: "profile.name profile.logo" },
          { path: "postedBy", select: "fullName" },
        ],
      });

    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const savedJobs = jobSeeker.savedJobs.map((savedJob) => ({
      _id: savedJob.jobId._id,
      title: savedJob.jobId.title,
      company: savedJob.jobId.companyId,
      postedBy: savedJob.jobId.postedBy,
      location: savedJob.jobId.location,
      jobType: savedJob.jobId.jobType,
      salary: savedJob.jobId.salary,
      experienceLevel: savedJob.jobId.experienceLevel,
      applicationDeadline: savedJob.jobId.applicationDeadline,
      status: savedJob.jobId.status,
      createdAt: savedJob.jobId.createdAt,
      savedAt: savedJob.savedAt,
    }));

    return res.status(200).json({
      message: "Saved jobs retrieved successfully",
      savedJobs,
    });
  } catch (error) {
    console.error("Error in getSavedJobs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAppliedJobs = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "job_seeker") {
      return res.status(403).json({ message: "Unauthorized: Only job seekers can view applied jobs" });
    }

    const jobSeeker = await require("../models/user/JobSeeker")
      .findOne({ userId })
      .populate({
        path: "appliedJobs.jobId",
        populate: [
          { path: "companyId", select: "profile.name profile.logo" },
          { path: "postedBy", select: "fullName" },
        ],
      });

    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const appliedJobs = jobSeeker.appliedJobs.map((appliedJob) => ({
      _id: appliedJob.jobId._id,
      title: appliedJob.jobId.title,
      company: appliedJob.jobId.companyId,
      postedBy: appliedJob.jobId.postedBy,
      location: appliedJob.jobId.location,
      jobType: appliedJob.jobId.jobType,
      salary: appliedJob.jobId.salary,
      experienceLevel: appliedJob.jobId.experienceLevel,
      applicationDeadline: appliedJob.jobId.applicationDeadline,
      status: appliedJob.jobId.status,
      createdAt: appliedJob.jobId.createdAt,
      appliedAt: appliedJob.appliedAt,
    }));

    return res.status(200).json({
      message: "Applied jobs retrieved successfully",
      appliedJobs,
    });
  } catch (error) {
    console.error("Error in getAppliedJobs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.hireCandidate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only Employers can hire candidates
    if (user.role !== "employer") {
      return res.status(403).json({ message: "Unauthorized: Only employers can hire candidates" });
    }

    const { jobId, jobSeekerId } = req.params;

    // Verify the job exists and was posted by this employer
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only hire candidates for jobs you posted" });
    }

    // Verify the job seeker exists and has applied for the job
    const jobSeeker = await require("../models/user/JobSeeker").findById(jobSeekerId);
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker not found" });
    }
    const hasApplied = job.applicants.some(
      (applicant) => applicant.userId.toString() === jobSeeker.userId.toString()
    );
    if (!hasApplied) {
      return res.status(400).json({ message: "This job seeker has not applied for the job" });
    }

    // Update the job's applicant status to "Hired"
    const applicant = job.applicants.find(
      (applicant) => applicant.userId.toString() === jobSeeker.userId.toString()
    );
    applicant.status = "Hired";
    await job.save();

    // Update the Employer's hiredCandidates
    const Employer = require("../models/user/Employer");
    const employer = await Employer.findOne({ userId });
    if (!employer) {
      return res.status(404).json({ message: "Employer profile not found" });
    }
    const alreadyHired = employer.hiredCandidates.some(
      (candidate) => candidate.jobSeekerId.toString() === jobSeekerId.toString()
    );
    if (alreadyHired) {
      return res.status(400).json({ message: "This candidate has already been hired" });
    }
    employer.hiredCandidates.push({ jobSeekerId, jobId });
    await employer.save();

    // Update the JobSeeker's status to "Hired"
    jobSeeker.status = "Hired";
    await jobSeeker.save();

    return res.status(200).json({ message: "Candidate hired successfully" });
  } catch (error) {
    console.error("Error in hireCandidate:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};