const Resume = require("../../models/resume/ResumeModel");
const Job = require("../../models/job/Job");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const logger = require("../../utils/logger");
const { sendNotification } = require("../utils/notificationUtility");
const { checkRole, checkJobExists, checkJobSeekerExists } = require("../../utils/checks");
const { getATSScore, generateCoverLetter } = require("../../services/aiService");

exports.getATSScoreAndSuggestions = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;

    checkRole(role, ["job_seeker"]);
    const job = await checkJobExists(jobId).lean();
    const resume = await Resume.findOne({ userId }).lean();
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
    res.status(200).json({ message: "ATS score and suggestions retrieved successfully", atsScore, improvementSuggestions });
  } catch (error) {
    logger.error(`Error in getATSScoreAndSuggestions: ${error.message}`);
    res.status(error.status || 500).json({ 
      message: error.message,
    });
  }
};

exports.generateCoverLetterForJob = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;

    checkRole(role, ["job_seeker"]);
    const job = await checkJobExists(jobId).lean();
    const resume = await Resume.findOne({ userId }).select("fullName contactInformation").lean();
    const jobSeeker = await checkJobSeekerExists(userId);

    if (!resume) throw new Error("Resume not found");

    const companyName = job.companyId?.name || "Unknown";
    const profile = { fullName: resume.fullName, contactInformation: resume.contactInformation };
    const coverLetter = await generateCoverLetter(resume, job, profile, companyName);

    const idx = jobSeeker.pendingApplications.findIndex((a) => a.jobId.toString() === jobId);
    if (idx !== -1) {
      jobSeeker.pendingApplications[idx].coverLetter = coverLetter;
    } else {
      jobSeeker.pendingApplications.push({ jobId, coverLetter });
    }

    await jobSeeker.save();
    res.status(200).json({ message: "Cover letter generated successfully", coverLetter });
  } catch (error) {
    logger.error(`Error in generateCoverLetterForJob: ${error.message}`);
    res.status(error.status || 500).json({ 
      message: error.message,
    });
  }
};

exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can apply for jobs");

    const job = await checkJobExists(jobId);
    const jobSeeker = await checkJobSeekerExists(userId);
    const resume = await Resume.findOne({ userId });

    if (!resume) {
      throw new Error("You must have a resume to apply for a job");
    }

    const pendingApp = jobSeeker.pendingApplications.find(
      (app) => app.jobId.toString() === jobId.toString()
    );
    if (!pendingApp || !pendingApp.coverLetter) {
      throw new Error("You must generate a cover letter before applying");
    }

    if (job.status !== "Open") {
      throw new Error("This job is not open for applications");
    }

    const applicationDeadline = new Date(job.applicationDeadline);
    if (applicationDeadline < new Date()) {
      throw new Error("Application deadline has passed");
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
      jobSeeker.pendingApplications = jobSeeker.pendingApplications.filter(
        (app) => app.jobId.toString() !== jobId.toString()
      );
      message = "Application canceled successfully";

      await sendNotification({
        userId: job.postedBy,
        type: "applicationUpdate",
        relatedId: job._id,
        message: `A candidate canceled their application for: ${job.title}`,
      });
    } else if (existingApplicationIndex === -1 && existingJobSeekerApplicationIndex === -1) {
      const coverLetter = pendingApp.coverLetter;
      const atsScore = pendingApp.atsScore;

      job.applicants.push({
        userId,
        resume: resume.uploadedResume || resume._id.toString(),
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
        status: "Applied",
      });

      jobSeeker.pendingApplications = jobSeeker.pendingApplications.filter(
        (app) => app.jobId.toString() !== jobId.toString()
      );

      message = "Application submitted successfully";

      await sendNotification({
        userId: job.postedBy,
        type: "applicationUpdate",
        relatedId: job._id,
        message: `A new candidate applied for: ${job.title}`,
      });
    } else {
      throw new Error("Application state is inconsistent. Please contact support.");
    }

    await job.save();
    await jobSeeker.save();

    res.status(200).json({ message });
  } catch (error) {
    logger.error(`Error in applyForJob: ${error.message}`);
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

    const job = await checkJobExists(jobId);
    const jobSeeker = await checkJobSeekerExists(userId);

    const isSavedInJobSeeker = jobSeeker.savedJobs.some(
      (savedJob) => savedJob.jobId.toString() === jobId.toString()
    );
    const isSavedInJob = job.savedBy.some(
      (saved) => saved.jobSeekerId.toString() === userId.toString()
    );

    let message;
    if (isSavedInJobSeeker || isSavedInJob) {
      jobSeeker.savedJobs = jobSeeker.savedJobs.filter(
        (savedJob) => savedJob.jobId.toString() !== jobId.toString()
      );
      job.savedBy = job.savedBy.filter(
        (saved) => saved.jobSeekerId.toString() !== userId.toString()
      );
      message = "Job unsaved successfully";
    } else {
      jobSeeker.savedJobs.push({ jobId, savedAt: new Date() });
      job.savedBy.push({ jobSeekerId: userId, savedAt: new Date() });
      message = "Job saved successfully";
    }

    await jobSeeker.save();
    await job.save();

    res.status(200).json({ message });
  } catch (error) {
    logger.error(`Error in saveJob: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while saving or unsaving the job",
    });
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own saved jobs");
    if (userId !== authenticatedUserId) {
      throw new Error("Unauthorized: You can only view your own saved jobs");
    }

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false })
      .select("savedJobs")
      .populate({
        path: "savedJobs.jobId",
        match: { isDeleted: false },
        select: "_id title companyId",
        populate: {
          path: "companyId",
          select: "name logo",
          match: { isDeleted: false },
        },
      })
      .lean();

    if (!jobSeeker) {
      throw new Error("Job seeker profile not found");
    }

    const total = jobSeeker.savedJobs.length;
    const startIndex = (page - 1) * limit;
    const paginatedJobs = jobSeeker.savedJobs.slice(startIndex, startIndex + parseInt(limit));

    const savedJobs = paginatedJobs
      .filter(savedJob => savedJob.jobId)
      .map((savedJob) => ({
        jobId: savedJob.jobId._id,
        title: savedJob.jobId.title,
        company: savedJob.jobId.companyId ? { companyId: savedJob.jobId.companyId._id, name: savedJob.jobId.companyId.name, logo: savedJob.jobId.companyId.logo } : null,
        savedAt: savedJob.savedAt,
      }));

    res.status(200).json({
      message: "Saved jobs retrieved successfully",
      savedJobs,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (error) {
    logger.error(`Error in getSavedJobs: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving saved jobs",
    });
  }
};

exports.getAppliedJobs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own applied jobs");
    if (userId !== authenticatedUserId) {
      throw new Error("Unauthorized: You can only view your own applied jobs");
    }

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false })
      .select("appliedJobs")
      .populate({
        path: "appliedJobs.jobId",
        match: { isDeleted: false },
        select: "_id title companyId status",
        populate: {
          path: "companyId",
          select: "name logo",
          match: { isDeleted: false },
        },
      })
      .lean();

    if (!jobSeeker) {
      throw new Error("Job seeker profile not found");
    }

    const total = jobSeeker.appliedJobs.length;
    const startIndex = (page - 1) * limit;
    const paginatedJobs = jobSeeker.appliedJobs.slice(startIndex, startIndex + parseInt(limit));

    const appliedJobs = paginatedJobs
      .filter(appliedJob => appliedJob.jobId)
      .map((appliedJob) => ({
        jobId: appliedJob.jobId._id,
        title: appliedJob.jobId.title,
        company: appliedJob.jobId.companyId ? { companyId: appliedJob.jobId.companyId._id, name: appliedJob.jobId.companyId.name, logo: appliedJob.jobId.companyId.logo } : null,
        jobStatus: appliedJob.jobId.status,
        appliedAt: appliedJob.appliedAt,
        applicationStatus: appliedJob.status,
      }));

    res.status(200).json({
      message: "Applied jobs retrieved successfully",
      appliedJobs,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (error) {
    logger.error(`Error in getAppliedJobs: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving applied jobs",
    });
  }
};

exports.getJobOffers = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own job offers");
    if (userId !== authenticatedUserId) {
      throw new Error("Unauthorized: You can only view your own job offers");
    }

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false })
      .select("jobOffers")
      .populate({
        path: "jobOffers.jobId",
        match: { isDeleted: false },
        select: "_id title companyId status",
        populate: {
          path: "companyId",
          select: "name logo",
          match: { isDeleted: false },
        },
      })
      .lean();

    if (!jobSeeker) {
      throw new Error("Job seeker profile not found");
    }

    const total = jobSeeker.jobOffers.length;
    const startIndex = (page - 1) * limit;
    const paginatedOffers = jobSeeker.jobOffers.slice(startIndex, startIndex + parseInt(limit));

    const jobOffers = paginatedOffers
      .filter(offer => offer.jobId)
      .map((offer) => ({
        jobId: offer.jobId._id,
        title: offer.jobId.title,
        company: offer.jobId.companyId ? { companyId: offer.jobId.companyId._id, name: offer.jobId.companyId.name, logo: offer.jobId.companyId.logo } : null,
        jobStatus: offer.jobId.status,
        offeredAt: offer.offeredAt,
        offerStatus: offer.status,
      }));

    res.status(200).json({
      message: "Job offers retrieved successfully",
      jobOffers,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (error) {
    logger.error(`Error in getJobOffers: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving job offers",
    });
  }
};

exports.respondToJobOffer = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;
    const { response } = req.body;

    if (!["accept", "reject"].includes(response)) {
      throw new Error("Invalid response. Must be 'accept' or 'reject'");
    }

    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can respond to job offers");

    const job = await checkJobExists(jobId);
    const jobSeeker = await checkJobSeekerExists(userId);

    const offerIndex = jobSeeker.jobOffers.findIndex(
      (offer) => offer.jobId.toString() === jobId.toString()
    );
    if (offerIndex === -1) {
      throw new Error("No job offer found for this job");
    }

    const offer = jobSeeker.jobOffers[offerIndex];
    if (offer.status !== "Pending") {
      throw new Error("This offer has already been responded to");
    }

    const applicantIndex = job.applicants.findIndex(
      (applicant) => applicant.userId.toString() === userId.toString()
    );
    if (applicantIndex === -1) {
      throw new Error("Applicant not found in job");
    }

    const appliedJobIndex = jobSeeker.appliedJobs.findIndex(
      (appliedJob) => appliedJob.jobId.toString() === jobId.toString()
    );
    if (appliedJobIndex === -1) {
      throw new Error("Applied job not found in job seeker's record");
    }

    if (response === "accept") {
      if (jobSeeker.status === "Hired") {
        throw new Error("You are already hired for another job");
      }

      offer.status = "Accepted";
      job.applicants[applicantIndex].status = "Hired";
      jobSeeker.appliedJobs[appliedJobIndex].status = "Hired";
      jobSeeker.status = "Hired";

      job.hiredCandidates.push({ jobSeekerId: jobSeeker._id });

      const employer = await Employer.findOne({ userId: job.postedBy });
      if (employer) {
        employer.hiredCandidates.push({ jobSeekerId: jobSeeker._id, jobId });
        await employer.save();
      }
    } else {
      offer.status = "Rejected";
      job.applicants[applicantIndex].status = "Rejected";
      jobSeeker.appliedJobs[appliedJobIndex].status = "Rejected";
    }

    await job.save();
    await jobSeeker.save();

    const employer = await Employer.findOne({ userId: job.postedBy });
    if (employer) {
      await sendNotification({
        userId: employer.userId,
        type: "applicationUpdate",
        relatedId: job._id,
        message: `Candidate ${response === "accept" ? "accepted" : "rejected"} your job offer for: ${job.title}`,
      });
    }

    res.status(200).json({
      message: `Job offer ${response}ed successfully`,
    });
  } catch (error) {
    logger.error(`Error in respondToJobOffer: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while responding to the job offer",
    });
  }
};