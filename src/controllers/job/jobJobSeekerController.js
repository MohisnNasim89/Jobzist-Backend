const Job = require("../../models/job/Job");
const JobSeeker = require("../../models/user/JobSeeker");
const Resume = require("../../models/resume/ResumeModel");
const {
  checkRole,
  checkJobExists,
  checkJobSeekerExists,
  renderProfileWithFallback,
} = require("../../utils/checks");
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const calculateATSScoreAndSuggestions = async (resume, job) => {
  try {
    const prompt = `
      You are an ATS (Applicant Tracking System) expert. Evaluate the following resume against the job description and requirements to calculate an ATS compatibility score (0-100) and provide improvement suggestions to better align the resume with the job.

      **Job Details:**
      - Title: ${job.title}
      - Description: ${job.description}
      - Skills: ${JSON.stringify(job.skills)}
      - Requirements: ${JSON.stringify(job.requirements)}
      - Experience Level: ${job.experienceLevel}

      **Resume Details:**
      - Full Name: ${resume.fullName}
      - Bio: ${resume.bio || "Not provided"}
      - Skills: ${JSON.stringify(resume.skills)}
      - Experiences: ${JSON.stringify(resume.experiences)}
      - Projects: ${JSON.stringify(resume.projects)}
      - Education: ${JSON.stringify(resume.education)}

      Provide the response in the following JSON format:
      {
        "atsScore": <number>,
        "improvementSuggestions": "<string>"
      }
      The ATS score should be a number between 0 and 100, reflecting keyword matches, skill alignment, and experience relevance. The improvement suggestions should be concise and actionable (100-150 words).
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();

    if (text.startsWith("```json") && text.endsWith("```")) {
      text = text.replace(/```json\s*|\s*```/g, "").trim();
    }

    const parsedResult = JSON.parse(text);
    return {
      atsScore: Math.max(0, Math.min(100, parsedResult.atsScore)),
      improvementSuggestions: parsedResult.improvementSuggestions,
    };
  } catch (error) {
    console.error("Error calculating ATS score and suggestions:", error);
    return { atsScore: null, improvementSuggestions: "Unable to generate suggestions due to an error." };
  }
};

const generateCoverLetter = async (resume, job, userProfile) => {
  try {
    const prompt = `
      You are a professional cover letter writer. Generate a professional cover letter for the following job seeker applying to the specified job. The cover letter should be concise (200-300 words), tailored to the job, and highlight the job seeker's relevant skills and experiences.

      **Job Details:**
      - Title: ${job.title}
      - Company: ${job.companyId ? (await require("../../models/company/Company").findById(job.companyId)).name : "Unknown Company"}
      - Description: ${job.description}
      - Skills: ${JSON.stringify(job.skills)}
      - Requirements: ${JSON.stringify(job.requirements)}
      - Experience Level: ${job.experienceLevel}

      **Job Seeker Details:**
      - Full Name: ${resume.fullName}
      - Bio: ${resume.bio || "Not provided"}
      - Skills: ${JSON.stringify(resume.skills)}
      - Experiences: ${JSON.stringify(resume.experiences)}
      - Projects: ${JSON.stringify(resume.projects)}
      - Education: ${JSON.stringify(resume.education)}

      **User Profile:**
      - Full Name: ${userProfile.fullName}
      - Contact Information: ${JSON.stringify(resume.contactInformation)}

      Provide the cover letter as plain text, addressed to the hiring manager, with a professional tone.
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating cover letter:", error);
    throw new Error("Failed to generate cover letter");
  }
};

exports.getATSScoreAndSuggestions = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can calculate ATS scores");

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
      const error = new Error("You must have a resume to calculate ATS score");
      error.status = 400;
      throw error;
    }

    const { atsScore, improvementSuggestions } = await calculateATSScoreAndSuggestions(resume, job);

    // Update or add to pendingApplications
    const pendingAppIndex = jobSeeker.pendingApplications.findIndex(
      (app) => app.jobId.toString() === jobId.toString()
    );
    if (pendingAppIndex !== -1) {
      jobSeeker.pendingApplications[pendingAppIndex].atsScore = atsScore;
      jobSeeker.pendingApplications[pendingAppIndex].improvementSuggestions = improvementSuggestions;
      jobSeeker.pendingApplications[pendingAppIndex].updatedAt = new Date();
    } else {
      jobSeeker.pendingApplications.push({
        jobId,
        atsScore,
        improvementSuggestions,
        updatedAt: new Date(),
      });
    }

    await jobSeeker.save();

    res.status(200).json({
      message: "ATS score and suggestions generated successfully",
      atsScore,
      improvementSuggestions,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while calculating ATS score",
    });
  }
};

exports.generateCoverLetterForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can generate cover letters");

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
      const error = new Error("You must have a resume to generate a cover letter");
      error.status = 400;
      throw error;
    }

    const userProfile = await require("../../models/user/UserProfile").findOne({ userId });
    const coverLetter = await generateCoverLetter(resume, job, userProfile);

    // Update or add to pendingApplications
    const pendingAppIndex = jobSeeker.pendingApplications.findIndex(
      (app) => app.jobId.toString() === jobId.toString()
    );
    if (pendingAppIndex !== -1) {
      jobSeeker.pendingApplications[pendingAppIndex].coverLetter = coverLetter;
      jobSeeker.pendingApplications[pendingAppIndex].updatedAt = new Date();
    } else {
      jobSeeker.pendingApplications.push({
        jobId,
        coverLetter,
        updatedAt: new Date(),
      });
    }

    await jobSeeker.save();

    res.status(200).json({
      message: "Cover letter generated successfully",
      coverLetter,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while generating the cover letter",
    });
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