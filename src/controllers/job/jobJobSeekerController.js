const Resume = require("../../models/resume/ResumeModel");
const Job = require("../../models/job/Job");
const JobSeeker = require("../../models/user/JobSeeker");
const { checkRole, checkJobExists, checkJobSeekerExists } = require("../../utils/checks");
const { getATSScore, generateCoverLetter } = require("../../services/aiService");

exports.getATSScoreAndSuggestions = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;

    checkRole(role, ["job_seeker"]);
    const job = await checkJobExists(jobId);
    const resume = await Resume.findOne({ userId });
    const jobSeeker = await checkJobSeekerExists(userId);

    if (!resume) throw new Error("Resume not found");

    const { atsScore, improvementSuggestions } = await getATSScore(resume, job);

    const idx = jobSeeker.pendingApplications.findIndex((a) => a.jobId.toString() === jobId);
    if (idx !== -1) {
      Object.assign(jobSeeker.pendingApplications[idx], { atsScore, improvementSuggestions });
    } else {
      jobSeeker.pendingApplications.push({ jobId, atsScore, improvementSuggestions });
    }

    await jobSeeker.save();
    res.status(200).json({ atsScore, improvementSuggestions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.generateCoverLetterForJob = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;

    checkRole(role, ["job_seeker"]);
    const job = await checkJobExists(jobId);
    const resume = await Resume.findOne({ userId });
    const jobSeeker = await checkJobSeekerExists(userId);

    if (!resume) throw new Error("Resume not found");

    const companyName = job.companyId?.name || "Unknown";
    const profile = { fullName: resume.fullName, contactInformation: resume.contactInformation };
    const coverLetter = await generateCoverLetter(resume, job, profile, companyName);

    const idx = jobSeeker.pendingApplications.findIndex((a) => a.jobId.toString() === jobId);
    if (idx !== -1) {
      Object.assign(jobSeeker.pendingApplications[idx], { coverLetter });
    } else {
      jobSeeker.pendingApplications.push({ jobId, coverLetter });
    }

    await jobSeeker.save();
    res.status(200).json({ coverLetter });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can apply for jobs");

    const job = await checkJobExists(jobId);
    if (!job) {
      const error = new Error("Job not found");
      error.status = 404;
      throw error;
    }

    const jobSeeker = await checkJobSeekerExists(userId);
    if (!jobSeeker) {
      const error = new Error("Job seeker profile not found");
      error.status = 404;
      throw error;
    }

    const resume = await Resume.findOne({ userId });
    if (!resume) {
      const error = new Error("You must have a resume to apply for a job");
      error.status = 400;
      throw error;
    }

    // Check for a pending application with a cover letter
    const pendingApp = jobSeeker.pendingApplications.find(
      (app) => app.jobId.toString() === jobId.toString()
    );
    if (!pendingApp || !pendingApp.coverLetter) {
      const error = new Error("You must generate a cover letter before applying");
      error.status = 400;
      throw error;
    }

    if (job.status !== "Open") {
      const error = new Error("This job is not open for applications");
      error.status = 400;
      throw error;
    }

    const applicationDeadline = new Date(job.applicationDeadline);
    if (applicationDeadline < new Date()) {
      const error = new Error("Application deadline has passed");
      error.status = 400;
      throw error;
    }

    const existingApplicationIndex = job.applicants.findIndex(
      (applicant) => applicant.userId.toString() === userId.toString()
    );
    const existingJobSeekerApplicationIndex = jobSeeker.appliedJobs.findIndex(
      (appliedJob) => appliedJob.jobId.toString() === jobId.toString()
    );

    let message;
    if (existingApplicationIndex !== -1 && existingJobSeekerApplicationIndex !== -1) {
      job.applicants.splice(existingApplicationIndex, 1);
      jobSeeker.appliedJobs.splice(existingJobSeekerApplicationIndex, 1);
      // Remove from pendingApplications
      jobSeeker.pendingApplications = jobSeeker.pendingApplications.filter(
        (app) => app.jobId.toString() !== jobId.toString()
      );
      message = "Application canceled successfully";
    } else if (existingApplicationIndex === -1 && existingJobSeekerApplicationIndex === -1) {
      // Use the stored cover letter and ATS score
      const coverLetter = pendingApp.coverLetter;
      const atsScore = pendingApp.atsScore;

      job.applicants.push({
        userId,
        appliedAt: new Date(),
        status: "Applied",
        coverLetter,
        atsScore,
      });
      jobSeeker.appliedJobs.push({
        jobId,
        appliedAt: new Date(),
        coverLetter,
        atsScore,
      });

      // Remove from pendingApplications after applying
      jobSeeker.pendingApplications = jobSeeker.pendingApplications.filter(
        (app) => app.jobId.toString() !== jobId.toString()
      );

      message = "Application submitted successfully";
    } else {
      const error = new Error("Application state is inconsistent. Please contact support.");
      error.status = 500;
      throw error;
    }

    await job.save();
    await jobSeeker.save();

    res.status(200).json({ message });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while applying for or canceling the job application",
    });
  }
};

exports.saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can save jobs");

    const jobQuery = checkJobExists(jobId);
    const job = await jobQuery.exec();
    if (!job) {
      const error = new Error("Job not found");
      error.status = 404;
      throw error;
    }

    const jobSeeker = await checkJobSeekerExists(userId);
    if (!jobSeeker) {
      const error = new Error("Job seeker profile not found");
      error.status = 404;
      throw error;
    }

    const existingSavedJobIndex = jobSeeker.savedJobs.findIndex(
      (savedJob) => savedJob.jobId.toString() === jobId.toString()
    );
    const existingSavedByIndex = job.savedBy.findIndex(
      (saved) => saved.jobSeekerId.toString() === userId.toString()
    );

    let message;
    if (existingSavedJobIndex !== -1 && existingSavedByIndex !== -1) {
      jobSeeker.savedJobs.splice(existingSavedJobIndex, 1);
      job.savedBy.splice(existingSavedByIndex, 1);
      message = "Job unsaved successfully";
    } else if (existingSavedJobIndex === -1 && existingSavedByIndex === -1) {
      jobSeeker.savedJobs.push({ jobId, savedAt: new Date() });
      job.savedBy.push({ jobSeekerId: userId, savedAt: new Date() });
      message = "Job saved successfully";
    } else {
      const error = new Error("Saved job state is inconsistent. Please contact support.");
      error.status = 500;
      throw error;
    }

    await jobSeeker.save();
    await job.save();

    res.status(200).json({ message });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while saving or unsaving the job",
    });
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own saved jobs");
    if (userId !== authenticatedUserId) {
      throw new Error("Unauthorized: You can only view your own saved jobs");
    }

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false }).populate({
      path: "savedJobs.jobId",
      match: { isDeleted: false },
      populate: [
        { path: "companyId", select: "name logo", match: { isDeleted: false } },
        { path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } },
      ],
    });

    if (!jobSeeker) {
      throw new Error("Job seeker profile not found");
    }

    const savedJobs = jobSeeker.savedJobs
      .filter((savedJob) => savedJob.jobId)
      .map((savedJob) => {
        const jobProfile = renderProfileWithFallback(savedJob.jobId, "job", {
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
        });
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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving saved jobs",
    });
  }
};

exports.getAppliedJobs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own applied jobs");
    if (userId !== authenticatedUserId) {
      throw new Error("Unauthorized: You can only view your own applied jobs");
    }

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false }).populate({
      path: "appliedJobs.jobId",
      match: { isDeleted: false },
      populate: [
        { path: "companyId", select: "name logo", match: { isDeleted: false } },
        { path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } },
      ],
    });

    if (!jobSeeker) {
      throw new Error("Job seeker profile not found");
    }

    const appliedJobs = jobSeeker.appliedJobs
      .filter((appliedJob) => appliedJob.jobId)
      .map((appliedJob) => {
        const jobProfile = renderProfileWithFallback(appliedJob.jobId, "job", {
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
        });
        return {
          ...jobProfile,
          appliedAt: appliedJob.appliedAt,
          coverLetter: appliedJob.coverLetter,
          atsScore: appliedJob.atsScore,
        };
      });

    res.status(200).json({
      message: "Applied jobs retrieved successfully",
      appliedJobs,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving applied jobs",
    });
  }
};