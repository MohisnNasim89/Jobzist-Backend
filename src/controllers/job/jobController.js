const Job = require("../../models/job/Job");
const User = require("../../models/user/Users");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const Company = require("../../models/company/Company");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const renderProfile = require("../../utils/renderProfile");

exports.createJob = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!["company_admin", "employer"].includes(role)) {
      return res.status(403).json({ message: "Unauthorized: Only company admins and employers can create jobs" });
    }

    let companyId = null;
    let company = null;

    if (role === "company_admin") {
      const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
      if (!companyAdmin) {
        return res.status(404).json({ message: "Company admin profile not found" });
      }
      companyId = companyAdmin.companyId;
      company = await Company.findOne({ _id: companyId, isDeleted: false });
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
    } else if (role === "employer") {
      const employer = await Employer.findOne({ userId: userId, isDeleted: false });
      if (!employer) {
        return res.status(404).json({ message: "Employer profile not found" });
      }

      if (employer.roleType === "Company Employer") {
        if (!employer.companyId) {
          return res.status(400).json({ message: "Company Employer must be associated with a company" });
        }
        companyId = employer.companyId;
        company = await Company.findOne({ _id: companyId, isDeleted: false });
        if (!company) {
          return res.status(404).json({ message: "Company not found" });
        }
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
    }

    if (role === "employer") {
      const employer = await Employer.findOne({ userId: userId, isDeleted: false });
      if (employer && employer.roleType === "Company Employer") {
        employer.jobListings.push({ jobId: job._id });
        await employer.save();
      }
    }

    let jobProfile;
    try {
      jobProfile = renderProfile(job, "job");
    } catch (error) {
      console.error("Error rendering job profile:", error);
      jobProfile = {
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
      };
    }

    res.status(200).json({
      message: "Job created successfully",
      job: jobProfile,
    });
  } catch (error) {
    console.error("Error in createJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { role, userId } = req.user;
    const updates = req.body;

    const job = await Job.findOne({ _id: jobId, isDeleted: false });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!["company_admin", "employer"].includes(role)) {
      return res.status(403).json({ message: "Unauthorized: Only company admins and employers can update jobs" });
    }

    if (role === "employer" && job.postedBy.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized: You can only update jobs you posted" });
    }

    if (role === "company_admin") {
      const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
      if (!companyAdmin || (job.companyId && companyAdmin.companyId.toString() !== job.companyId.toString())) {
        return res.status(403).json({ message: "Unauthorized: You can only update jobs for your company" });
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

    let jobProfile;
    try {
      jobProfile = renderProfile(job, "job");
    } catch (error) {
      console.error("Error rendering job profile:", error);
      jobProfile = {
        _id: job._id,
        title: job.title,
        companyId: job.companyId,
        company: company ? { _id: company._id, name: company._id, logo: company.logo } : null,
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
      };
    }

    res.status(200).json({
      message: "Job updated successfully",
      job: jobProfile,
    });
  } catch (error) {
    console.error("Error in updateJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { role, userId } = req.user;

    const job = await Job.findOne({ _id: jobId, isDeleted: false });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!["company_admin", "employer"].includes(role)) {
      return res.status(403).json({ message: "Unauthorized: Only company admins and employers can delete jobs" });
    }

    if (role === "employer" && job.postedBy.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized: You can only delete jobs you posted" });
    }

    if (role === "company_admin") {
      const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
      if (!companyAdmin || (job.companyId && companyAdmin.companyId.toString() !== job.companyId.toString())) {
        return res.status(403).json({ message: "Unauthorized: You can only delete jobs for your company" });
      }
    }

    if (job.companyId) {
      const company = await Company.findOne({ _id: job.companyId, isDeleted: false });
      if (company) {
        company.jobListings = company.jobListings.filter(
          (listing) => listing.jobId.toString() !== jobId.toString()
        );
        await company.save();
      }
    }

    if (role === "employer") {
      const employer = await Employer.findOne({ userId: userId, isDeleted: false });
      if (employer && employer.roleType === "Company Employer") {
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
    console.error("Error in deleteJob:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.hireCandidate = async (req, res) => {
  try {
    const { jobId, jobSeekerId } = req.params;
    const { userId, role } = req.user;

    if (role !== "employer") {
      return res.status(403).json({ message: "Unauthorized: Only employers can hire candidates" });
    }

    const job = await Job.findOne({ _id: jobId, isDeleted: false });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.postedBy.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized: You can only hire for jobs you posted" });
    }

    const jobSeeker = await JobSeeker.findOne({ _id: jobSeekerId, isDeleted: false });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker not found" });
    }

    const applicant = job.applicants.find((applicant) => applicant.userId.toString() === jobSeeker.userId.toString());
    if (!applicant) {
      return res.status(400).json({ message: "This job seeker has not applied for the job" });
    }

    const employer = await Employer.findOne({ userId: userId, isDeleted: false });
    if (!employer) {
      return res.status(404).json({ message: "Employer profile not found" });
    }

    const alreadyHired = employer.hiredCandidates.some(
      (candidate) => candidate.jobSeekerId.toString() === jobSeekerId.toString()
    );
    const alreadyHiredInJob = job.hiredCandidates.some(
      (candidate) => candidate.jobSeekerId.toString() === jobSeekerId.toString()
    );
    if (alreadyHired || alreadyHiredInJob) {
      return res.status(400).json({ message: "This candidate has already been hired" });
    }

    // Update the job's applicant status to "Hired"
    applicant.status = "Hired";
    job.hiredCandidates.push({ jobSeekerId });

    // Update the Employer's hiredCandidates
    employer.hiredCandidates.push({ jobSeekerId, jobId });
    await employer.save();

    // Update the JobSeeker's status to "Hired"
    jobSeeker.status = "Hired";
    await jobSeeker.save();

    await job.save();

    res.status(200).json({ message: "Candidate hired successfully" });
  } catch (error) {
    console.error("Error in hireCandidate:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};