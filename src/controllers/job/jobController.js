const Job = require("../../models/job/Job");
const Company = require("../../models/company/Company");
const JobSeeker = require("../../models/user/JobSeeker");
const UserProfile = require("../../models/user/UserProfile");
const Resume = require("../../models/resume/ResumeModel");
const Employer = require("../../models/user/Employer");
const logger = require("../../utils/logger");
const { sendNotification, sendNotificationsToUsers } = require("../utils/notificationUtility");
const {
  checkUserExists,
  checkRole,
  checkJobExists,
  checkCompanyExists,
  checkEmployerExists,
  checkCompanyAdminExists,
} = require("../../utils/checks");

exports.createJob = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const user = await checkUserExists(userId);
    checkRole(role, ["company_admin", "employer"], "Unauthorized: Only company admins and employers can create jobs");

    let companyId = null;
    let company = null;

    if (role === "company_admin") {
      const companyAdmin = await checkCompanyAdminExists(userId);
      companyId = companyAdmin.companyId;
      company = await checkCompanyExists(companyId);
    } else if (role === "employer") {
      const employer = await checkEmployerExists(userId);
      if (employer.roleType === "Company Employer") {
        if (!employer.companyId) {
          throw new Error("Company Employer must be associated with a company");
        }
        companyId = employer.companyId;
        company = await checkCompanyExists(companyId);
      }
    }

    const jobData = {
      ...req.body,
      companyId,
      postedBy: userId,
      status: req.body.status || "Draft",
    };

    const job = new Job(jobData);
    await job.save();

    if (companyId && company) {
      company.jobListings.push(job._id);
      await company.save();

      const followers = await UserProfile.find({ followedCompanies: companyId })
        .select("userId")
        .lean();
      if (followers.length > 0) {
        const followerIds = followers.map(follower => follower.userId);
        await sendNotificationsToUsers({
          userIds: followerIds,
          type: "newJob",
          relatedId: job._id,
          message: `${company.name} posted a new job: ${job.title}`,
        });
      }
    }

    if (role === "employer") {
      const employer = await checkEmployerExists(userId);
      employer.jobListings.push(job._id);
      await employer.save();

      const connections = await UserProfile.find({ connections: userId })
        .select("userId")
        .lean();
      if (connections.length > 0) {
        const connectionIds = connections.map(conn => conn.userId);
        await sendNotificationsToUsers({
          userIds: connectionIds,
          type: "newJob",
          relatedId: job._id,
          message: `Your connection ${employer.profileId?.fullName || "an employer"} posted a new job: ${job.title}`,
        });
      }
    }

    res.status(200).json({
      message: "Job created successfully",
      job: {
        jobId: job._id,
        title: job.title,
        companyId: job.companyId,
        companyName: company?.name || null,
        status: job.status,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    logger.error(`Error creating job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while creating the job",
    });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { role, userId } = req.user;
    const updates = req.body;

    const job = await checkJobExists(jobId);
    checkRole(role, ["company_admin", "employer"], "Unauthorized: Only company admins and employers can update jobs");

    if (role === "employer" && job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only update jobs you posted");
    }

    if (role === "company_admin") {
      const companyAdmin = await checkCompanyAdminExists(userId);
      if (job.companyId && companyAdmin.companyId.toString() !== job.companyId.toString()) {
        throw new Error("Unauthorized: You can only update jobs for your company");
      }
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

    const company = job.companyId ? await Company.findOne({ _id: job.companyId, isDeleted: false })
      .select("name")
      .lean() : null;

    res.status(200).json({
      message: "Job updated successfully",
      job: {
        jobId: job._id,
        title: job.title,
        companyId: job.companyId,
        companyName: company?.name || null,
        status: job.status,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    logger.error(`Error updating job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while updating the job",
    });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { role, userId } = req.user;

    const job = await checkJobExists(jobId).lean();
    checkRole(role, ["company_admin", "employer"], "Unauthorized: Only company admins and employers can delete jobs");

    if (role === "employer" && job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only delete jobs you posted");
    }

    if (role === "company_admin") {
      const companyAdmin = await checkCompanyAdminExists(userId);
      if (job.companyId && companyAdmin.companyId.toString() !== job.companyId.toString()) {
        throw new Error("Unauthorized: You can only delete jobs for your company");
      }
    }

    if (job.companyId) {
      const company = await checkCompanyExists(job.companyId);
      company.jobListings = company.jobListings.filter(id => id.toString() !== jobId.toString());
      await company.save();
    }

    if (role === "employer") {
      const employer = await checkEmployerExists(userId);
      if (employer.roleType === "Company Employer") {
        employer.jobListings = employer.jobListings.filter(id => id.toString() !== jobId.toString());
        await employer.save();
      }
    }

    await JobSeeker.updateMany(
      { "appliedJobs.jobId": jobId },
      { $pull: { appliedJobs: { jobId } } }
    );
    await JobSeeker.updateMany(
      { "savedJobs.jobId": jobId },
      { $pull: { savedJobs: { jobId } } }
    );
    await JobSeeker.updateMany(
      { "jobOffers.jobId": jobId },
      { $pull: { jobOffers: { jobId } } }
    );

    await Job.findById(jobId).then(job => job.softDelete());

    res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the job",
    });
  }
};

exports.hireCandidate = async (req, res) => {
  try {
    const { jobId, jobSeekerId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["employer"], "Unauthorized: Only employers can hire candidates");

    const job = await checkJobExists(jobId);
    if (job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only hire for jobs you posted");
    }

    const jobSeeker = await JobSeeker.findOne({ userId: jobSeekerId, isDeleted: false });
    if (!jobSeeker) {
      throw new Error("Job seeker not found");
    }

    const applicant = job.applicants.find((applicant) => applicant.userId.toString() === jobSeeker.userId.toString());
    if (!applicant) {
      throw new Error("This job seeker has not applied for the job");
    }

    const employer = await checkEmployerExists(userId);

    const alreadyHired = employer.hiredCandidates.some(
      (candidate) => candidate.jobSeekerId.toString() === jobSeekerId.toString()
    );
    const alreadyHiredInJob = job.hiredCandidates.some(
      (candidate) => candidate.jobSeekerId.toString() === jobSeekerId.toString()
    );
    if (alreadyHired || alreadyHiredInJob) {
      throw new Error("This candidate has already been hired");
    }

    const alreadyOffered = jobSeeker.jobOffers.some(
      (offer) => offer.jobId.toString() === jobId.toString() && offer.status === "Pending"
    );
    if (alreadyOffered) {
      throw new Error("This candidate has already been offered this job");
    }

    applicant.status = "Offered";
    const appliedJobIndex = jobSeeker.appliedJobs.findIndex(
      (appliedJob) => appliedJob.jobId.toString() === jobId.toString()
    );
    if (appliedJobIndex !== -1) {
      jobSeeker.appliedJobs[appliedJobIndex].status = "Offered";
    }

    jobSeeker.jobOffers.push({ jobId });
    await job.save();
    await jobSeeker.save();

    await sendNotification({
      userId: jobSeeker.userId,
      type: "jobOffer",
      relatedId: job._id,
      message: `You have received a job offer for: ${job.title}`,
    });

    res.status(200).json({ message: "Job offer sent to candidate successfully" });
  } catch (error) {
    logger.error(`Error sending job offer: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while sending the job offer",
    });
  }
};

exports.toggleJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;

    const job = await checkJobExists(jobId);
    checkRole(role, ["company_admin", "employer"], "Unauthorized: Only company admins and employers can toggle job status");

    if (role === "employer" && job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only toggle status for jobs you posted");
    }

    if (role === "company_admin") {
      const companyAdmin = await checkCompanyAdminExists(userId);
      if (job.companyId && companyAdmin.companyId.toString() !== job.companyId.toString()) {
        throw new Error("Unauthorized: You can only toggle status for jobs in your company");
      }
    }

    const newStatus = job.status === "Open" ? "Closed" : "Open";
    job.status = newStatus;
    await job.save();

    if (newStatus === "Open") {
      const employer = await checkEmployerExists(job.postedBy);
      const company = job.companyId ? await checkCompanyExists(job.companyId) : null;

      let connectionIds = [];
      if (employer) {
        const employerConnections = await UserProfile.find({ connections: job.postedBy })
          .select("userId")
          .lean();
        connectionIds = employerConnections.map(conn => conn.userId);
      }
      if (company && companyId) {
        const companyConnections = await UserProfile.find({ connections: { $in: companyAdminIds } })
          .select("userId")
          .lean();
        connectionIds = [...connectionIds, ...companyConnections.map(conn => conn.userId)];
      }

      if (connectionIds.length > 0) {
        await sendNotificationsToUsers({
          userIds: connectionIds,
          type: "jobStatusUpdate",
          relatedId: job._id,
          message: `The job "${job.title}" is now open for applications.`,
        });
      }
    }

    if (job.applicants.length > 0) {
      const message = newStatus === "Open"
        ? `The job "${job.title}" is now open for applications.`
        : `Applications for the job "${job.title}" are now closed.`;
      const applicantIds = job.applicants.map(applicant => applicant.userId);
      await sendNotificationsToUsers({
        userIds: applicantIds,
        type: "applicationUpdate",
        relatedId: job._id,
        message,
      });
    }

    res.status(200).json({
      message: `Job application status toggled to ${newStatus} successfully`,
      job: {
        jobId: job._id,
        title: job.title,
        status: job.status,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    logger.error(`Error toggling job status: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while toggling job status",
    });
  }
};

exports.previewApplicantResume = async (req, res) => {
  try {
    const { jobId, jobSeekerId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["employer"], "Unauthorized: Only employers can preview resumes");

    const job = await checkJobExists(jobId).lean();
    if (job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only preview resumes for jobs you posted");
    }

    const applicant = job.applicants.find((applicant) => applicant.userId.toString() === jobSeekerId.toString());
    if (!applicant) {
      throw new Error("This job seeker has not applied for the job");
    }

    const resume = await Resume.findOne({ userId: jobSeekerId }).lean();
    if (!resume) {
      throw new Error("Resume not found for this job seeker");
    }

    res.status(200).json({
      message: "Resume preview retrieved successfully",
      resume: {
        userId: resume.userId,
        fullName: resume.fullName,
        bio: resume.bio,
        location: resume.location,
        contactInformation: resume.contactInformation,
        socialLinks: resume.socialLinks,
        education: resume.education,
        experiences: resume.experiences,
        projects: resume.projects,
        skills: resume.skills,
        uploadedResume: resume.uploadedResume,
      },
      coverLetter: applicant.coverLetter,
      atsScore: applicant.atsScore,
    });
  } catch (error) {
    logger.error(`Error previewing applicant resume: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while previewing the resume",
    });
  }
};

exports.downloadApplicantResume = async (req, res) => {
  try {
    const { jobId, jobSeekerId } = req.params;
    const { userId, role } = req.user;

    checkRole(role, ["employer"], "Unauthorized: Only employers can download resumes");

    const job = await checkJobExists(jobId).lean();
    if (job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only download resumes for jobs you posted");
    }

    const applicant = job.applicants.find((applicant) => applicant.userId.toString() === jobSeekerId.toString());
    if (!applicant) {
      throw new Error("This job seeker has not applied for the job");
    }

    const resume = await Resume.findOne({ userId: jobSeekerId, isDeleted: false })
      .select("userId uploadedResume")
      .lean();
    if (!resume) {
      throw new Error("Resume not found for this job seeker");
    }

    if (!resume.uploadedResume) {
      throw new Error("No uploaded resume file available for download");
    }

    res.status(200).json({
      message: "Resume download link retrieved successfully",
      downloadUrl: resume.uploadedResume,
    });
  } catch (error) {
    logger.error(`Error downloading applicant resume: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the resume download link",
    });
  }
};

exports.getJobApplicants = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["employer", "company_admin"], "Unauthorized: Only employers and company admins can view job applicants");

    const job = await Job.findOne({ _id: jobId, isDeleted: false })
      .select("applicants postedBy companyId")
      .populate({
        path: "applicants.userId",
        model: "JobSeeker",
        match: { isDeleted: false },
        select: "userId fullName",
        populate: {
          path: "userId",
          model: "User",
          select: "email",
          match: { isDeleted: false },
        },
      })
      .lean();

    if (!job) {
      throw new Error("Job not found");
    }
    if (role === "employer" && job.postedBy.toString() !== userId) {
      throw new Error("Unauthorized: You can only view applicants for jobs you posted");
    }

    if (role === "company_admin") {
      const companyAdmin = await checkCompanyAdminExists(userId);
      if (job.companyId && companyAdmin.companyId.toString() !== job.companyId.toString()) {
        throw new Error("Unauthorized: You can only view applicants for jobs in your company");
      }
    }

    if (!job.applicants || job.applicants.length === 0) {
      return res.status(200).json({
        message: "No applicants found for this job",
        applicants: [],
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
      });
    }

    const total = job.applicants.length;
    const startIndex = (page - 1) * limit;
    const paginatedApplicants = job.applicants.slice(startIndex, startIndex + parseInt(limit));

    const applicants = paginatedApplicants
      .filter(applicant => applicant.userId)
      .map((applicant) => ({
        userId: applicant.userId._id,
        fullName: applicant.userId?.fullName || "N/A",
        email: applicant.userId?.userId?.email || "N/A",
        appliedAt: applicant.appliedAt,
        status: applicant.status,
      }));

    res.status(200).json({
      message: "Job applicants retrieved successfully",
      applicants,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (error) {
    logger.error(`Error retrieving job applicants: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving job applicants",
    });
  }
};