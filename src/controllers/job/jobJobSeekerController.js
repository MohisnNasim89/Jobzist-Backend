const Job = require("../../models/job/Job");
const JobSeeker = require("../../models/user/JobSeeker");
const renderProfile = require("../../utils/renderProfile");

exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    if (role !== "job_seeker") {
      return res.status(403).json({ message: "Unauthorized: Only job seekers can apply for jobs" });
    }

    const job = await Job.findOne({ _id: jobId, isDeleted: false });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.status !== "Open") {
      return res.status(400).json({ message: "This job is not open for applications" });
    }

    const applicationDeadline = new Date(job.applicationDeadline);
    if (applicationDeadline < new Date()) {
      return res.status(400).json({ message: "Application deadline has passed" });
    }

    const jobSeeker = await JobSeeker.findOne({ userId: userId, isDeleted: false });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const alreadyApplied = job.applicants.some((applicant) => applicant.userId.toString() === userId);
    if (alreadyApplied) {
      return res.status(400).json({ message: "You have already applied for this job" });
    }

    job.applicants.push({ userId: userId });
    await job.save();

    jobSeeker.appliedJobs.push({ jobId });
    await jobSeeker.save();

    res.status(200).json({ message: "Application submitted successfully" });
  } catch (error) {
    console.error("Error in applyForJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    if (role !== "job_seeker") {
      return res.status(403).json({ message: "Unauthorized: Only job seekers can save jobs" });
    }

    const job = await Job.findOne({ _id: jobId, isDeleted: false });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const jobSeeker = await JobSeeker.findOne({ userId: userId, isDeleted: false });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const alreadySaved = jobSeeker.savedJobs.some((savedJob) => savedJob.jobId.toString() === jobId);
    const alreadySavedInJob = job.savedBy.some((saved) => saved.jobSeekerId.toString() === userId);
    if (alreadySaved || alreadySavedInJob) {
      return res.status(400).json({ message: "You have already saved this job" });
    }

    jobSeeker.savedJobs.push({ jobId });
    job.savedBy.push({ jobSeekerId: userId });
    await jobSeeker.save();
    await job.save();

    res.status(200).json({ message: "Job saved successfully" });
  } catch (error) {
    console.error("Error in saveJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    const { Id } = req.params;
    const { userId, role } = req.user;

    if (role !== "job_seeker" || Id !== userId) {
      return res.status(403).json({ message: "Unauthorized: You can only view your own saved jobs" });
    }

    const jobSeeker = await JobSeeker.findOne({ userId: userId, isDeleted: false }).populate({
      path: "savedJobs.jobId",
      match: { isDeleted: false },
      populate: [
        { path: "companyId", select: "name logo", match: { isDeleted: false } },
        { path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } },
      ],
    });

    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const savedJobs = jobSeeker.savedJobs
      .filter((savedJob) => savedJob.jobId) // Ensure the job exists
      .map((savedJob) => {
        let jobProfile;
        try {
          jobProfile = renderProfile(savedJob.jobId, "job");
        } catch (error) {
          console.error("Error rendering job profile:", error);
          jobProfile = {
            _id: savedJob.jobId._id,
            title: savedJob.jobId.title,
            company: savedJob.jobId.companyId ? { _id: savedJob.jobId.companyId._id, name: savedJob.jobId.companyId.name, logo: savedJob.jobId.companyId.logo } : null,
            postedBy: savedJob.jobId.postedBy?.profileId?.fullName || "Unknown",
            location: savedJob.jobId.location,
            jobType: savedJob.jobId.jobType,
            salary: savedJob.jobId.salary,
            experienceLevel: savedJob.jobId.experienceLevel,
            applicationDeadline: savedJob.jobId.applicationDeadline,
            status: savedJob.jobId.status,
            createdAt: savedJob.jobId.createdAt,
            savedAt: savedJob.savedAt,
          };
        }
        return {
          ...jobProfile,
          savedAt: savedJob.savedAt,
        };
      });

    res.status(200).json({
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
    const { Id } = req.params;
    const { userId, role } = req.user;

    if (role !== "job_seeker" || Id !== userId) {
      return res.status(403).json({ message: "Unauthorized: You can only view your own applied jobs" });
    }

    const jobSeeker = await JobSeeker.findOne({ userId: userId, isDeleted: false }).populate({
      path: "appliedJobs.jobId",
      match: { isDeleted: false },
      populate: [
        { path: "companyId", select: "name logo", match: { isDeleted: false } },
        { path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } },
      ],
    });

    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    const appliedJobs = jobSeeker.appliedJobs
      .filter((appliedJob) => appliedJob.jobId) // Ensure the job exists
      .map((appliedJob) => {
        let jobProfile;
        try {
          jobProfile = renderProfile(appliedJob.jobId, "job");
        } catch (error) {
          console.error("Error rendering job profile:", error);
          jobProfile = {
            _id: appliedJob.jobId._id,
            title: appliedJob.jobId.title,
            company: appliedJob.jobId.companyId ? { _id: appliedJob.jobId.companyId._id, name: appliedJob.jobId.companyId.name, logo: appliedJob.jobId.companyId.logo } : null,
            postedBy: appliedJob.jobId.postedBy?.profileId?.fullName || "Unknown",
            location: appliedJob.jobId.location,
            jobType: appliedJob.jobId.jobType,
            salary: appliedJob.jobId.salary,
            experienceLevel: appliedJob.jobId.experienceLevel,
            applicationDeadline: appliedJob.jobId.applicationDeadline,
            status: appliedJob.jobId.status,
            createdAt: appliedJob.jobId.createdAt,
            appliedAt: appliedJob.appliedAt,
          };
        }
        return {
          ...jobProfile,
          appliedAt: appliedJob.appliedAt,
        };
      });

    res.status(200).json({
      message: "Applied jobs retrieved successfully",
      appliedJobs,
    });
  } catch (error) {
    console.error("Error in getAppliedJobs:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};