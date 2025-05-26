const Job = require("../../models/job/Job");
const Company = require("../../models/company/Company");
const JobSeeker = require("../../models/user/JobSeeker");
const UserProfile = require("../../models/user/UserProfile");
const Notification = require("../../models/notification/Notification");
const Resume = require("../../models/resume/ResumeModel");
const logger = require("../../utils/logger");

const {
  checkUserExists,
  checkRole,
  checkJobExists,
  checkCompanyExists,
  checkEmployerExists,
  checkCompanyAdminExists,
  renderProfileWithFallback,
} = require("../../utils/checks");
const { emitNotification } = require("../../socket/socket");

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
      company.jobListings.push({ jobId: job._id });
      await company.save();

      const followers = await UserProfile.find({ followedCompanies: companyId })
        .select("userId followedCompanies")
        .lean();
      if (followers.length > 0) {
        const notifications = followers.map((follower) => ({
          userId: follower.userId,
          type: "newJob",
          relatedId: job._id,
          message: `${company.name} posted a new job: ${job.title}`,
          createdAt: new Date(),
        }));
        await Notification.insertMany(notifications);
        notifications.forEach((notification) => {
          emitNotification(notification.userId.toString(), notification);
        });
      }
    }

    if (role === "employer") {
      const employer = await checkEmployerExists(userId);
      employer.jobListings.push({ jobId: job._id });
      await employer.save();
    }

    const jobProfile = renderProfileWithFallback(job, "job", {
      _id: job._id,
      title: job.title,
      companyId: job.companyId,
      company: company ? { _id: company._id, name: company.name, logo: company.logo } : null,
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
    });

    res.status(200).json({
      message: "Job created successfully",
      job: jobProfile,
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
      .select("_id name logo")
      .lean() : null;

    const jobProfile = renderProfileWithFallback(job, "job", {
      _id: job._id,
      title: job.title,
      companyId: job.companyId,
      company: company ? { _id: company._id, name: company.name, logo: company.logo } : null,
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
    });

    res.status(200).json({
      message: "Job updated successfully",
      job: jobProfile,
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
      company.jobListings = company.jobListings.filter(
        (listing) => listing.jobId.toString() !== jobId.toString()
      );
      await company.save();
    }

    if (role === "employer") {
      const employer = await checkEmployerExists(userId);
      if (employer.roleType === "Company Employer") {
        employer.jobListings = employer.jobListings.filter(
          (listing) => listing.jobId.toString() !== jobId.toString()
        );
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

    const jobSeeker = await JobSeeker.findOne({ _id: jobSeekerId, isDeleted: false })
      .select("userId status")
      .lean();
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

    applicant.status = "Hired";
    job.hiredCandidates.push({ jobSeekerId });

    employer.hiredCandidates.push({ jobSeekerId, jobId });
    await employer.save();

    await JobSeeker.findByIdAndUpdate(jobSeekerId, { status: "Hired" });

    const jobSeekerDoc = await JobSeeker.findOne({ _id: jobSeekerId });
    const appliedJobIndex = jobSeekerDoc.appliedJobs.findIndex(
      (appliedJob) => appliedJob.jobId.toString() === jobId.toString()
    );
    if (appliedJobIndex !== -1) {
      jobSeekerDoc.appliedJobs[appliedJobIndex].status = "Hired";
      await jobSeekerDoc.save();
    }

    await job.save();

    const notification = new Notification({
      userId: jobSeeker.userId,
      type: "applicationUpdate",
      relatedId: job._id,
      message: `You have been hired for the job: ${job.title}`,
    });
    await notification.save();
    emitNotification(jobSeeker.userId.toString(), notification);

    res.status(200).json({ message: "Candidate hired successfully" });
  } catch (error) {
    logger.error(`Error hiring candidate: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while hiring the candidate",
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

    if (job.applicants.length > 0) {
      const notificationMessage = newStatus === "Open"
        ? `The job "${job.title}" is now open for applications.`
        : `Applications for the job "${job.title}" are now closed.`;
      const applicantNotifications = job.applicants.map((applicant) => ({
        userId: applicant.userId,
        type: "applicationUpdate",
        relatedId: job._id,
        message: notificationMessage,
        createdAt: new Date(),
      }));
      await Notification.insertMany(applicantNotifications);
      applicantNotifications.forEach((notification) => {
        emitNotification(notification.userId.toString(), notification);
      });
    }

    const company = job.companyId ? await Company.findOne({ _id: job.companyId, isDeleted: false })
      .select("_id name logo")
      .lean() : null;

    const jobProfile = renderProfileWithFallback(job, "job", {
      _id: job._id,
      title: job.title,
      companyId: job.companyId,
      company: company ? { _id: company._id, name: company.name, logo: company.logo } : null,
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
    });

    res.status(200).json({
      message: `Job application status toggled to ${newStatus} successfully`,
      job: jobProfile,
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

    const resume = await Resume.findOne({ userId: jobSeekerId, isDeleted: false })
      .select("userId fullName bio location contactInformation socialLinks education experiences projects skills uploadedResume")
      .lean();
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

    checkRole(role, ["employer", "company_admin"], "Unauthorized: Only employers and company admins can view job applicants");

    const job = await Job.findOne({ _id: jobId, isDeleted: false })
      .populate({
        path: "applicants.userId",
        model: "JobSeeker",
        match: { isDeleted: false }, 
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
      });
    }

    const applicants = job.applicants.map((applicant) => {
      const user = applicant.userId?.userId; 
      return {
        userId: applicant.userId?._id,
        email: user?.email || "N/A", 
        fullName: applicant.userId?.fullName || "N/A",
        appliedAt: applicant.appliedAt,
        status: applicant.status,
        coverLetter: applicant.coverLetter,
        atsScore: applicant.atsScore,
        resume: applicant.resume,
      };
    });

    res.status(200).json({
      message: "Job applicants retrieved successfully",
      applicants,
    });
  } catch (error) {
    logger.error(`Error retrieving job applicants: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving job applicants",
    });
  }
};