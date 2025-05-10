const Job = require("../../models/job/Job");
const Company = require("../../models/company/Company");
const JobSeeker = require("../../models/user/JobSeeker");
const UserProfile = require("../../models/user/UserProfile");
const Notification = require("../../models/notification/Notification");

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

      const followers = await UserProfile.find({ followedCompanies: companyId });
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
      if (employer.roleType === "Company Employer") {
        employer.jobListings.push({ jobId: job._id });
        await employer.save();
      }
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

    const company = job.companyId ? await Company.findOne({ _id: job.companyId, isDeleted: false }) : null;

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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while updating the job",
    });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { role, userId } = req.user;

    const job = await checkJobExists(jobId);
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

    await job.softDelete();

    res.status(200).json({ message: "Job deleted successfully" });
  } catch (error) {
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

    const jobSeeker = await JobSeeker.findOne({ _id: jobSeekerId, isDeleted: false });
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

    jobSeeker.status = "Hired";
    await jobSeeker.save();

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

    // Toggle status between "Open" and "Closed"
    const newStatus = job.status === "Open" ? "Closed" : "Open";
    job.status = newStatus;
    await job.save();

    // Notify applicants regardless of the new status
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

    const company = job.companyId ? await Company.findOne({ _id: job.companyId, isDeleted: false }) : null;

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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while toggling job status",
    });
  }
};