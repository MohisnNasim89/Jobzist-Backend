const User = require("../../models/user/Users");
const Job = require("../../models/job/Job");
const Company = require("../../models/company/Company");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const { checkRole } = require("../../utils/checks");

exports.getCompanyUsers = async (req, res) => {
  try {
    const { userId, role } = req.user;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can view company users");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to retrieve company users: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("Manage Company Users")) {
      throw new Error("Failed to retrieve company users: Permission denied");
    }

    const company = await Company.findById(companyAdmin.companyId).select("employees");
    if (!company) {
      throw new Error("Failed to retrieve company users: Company not found");
    }

    const users = await User.find({ _id: { $in: company.employees }, isDeleted: false }).select("email role createdAt updatedAt");

    res.status(200).json({
      message: "Company users retrieved successfully",
      users,
    });
  } catch (error) {
    console.error("Error retrieving company users:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to retrieve company users: An unexpected error occurred",
    });
  }
};

exports.assignCompanyUserRole = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { targetUserId, newRole } = req.body;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can assign company user roles");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to assign company user role: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("Manage Company Users")) {
      throw new Error("Failed to assign company user role: Permission denied");
    }

    const company = await Company.findById(companyAdmin.companyId).select("employees");
    if (!company) {
      throw new Error("Failed to assign company user role: Company not found");
    }

    if (!company.employees.includes(targetUserId)) {
      throw new Error("Failed to assign company user role: Target user is not part of this company");
    }

    const targetUser = await User.findById(targetUserId).select("role");
    if (!targetUser) {
      throw new Error("Failed to assign company user role: Target user not found");
    }

    const validRoles = ["job_seeker", "employer"];
    if (!validRoles.includes(newRole)) {
      throw new Error("Failed to assign company user role: Invalid role specified");
    }

    targetUser.role = newRole;
    await targetUser.save();

    res.status(200).json({
      message: "Company user role assigned successfully",
      user: { userId: targetUserId, role: newRole },
    });
  } catch (error) {
    console.error("Error assigning company user role:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to assign company user role: An unexpected error occurred",
    });
  }
};

exports.fireEmployer = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { targetUserId } = req.params;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can fire employers");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to fire employer: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("Fire Employers")) {
      throw new Error("Failed to fire employer: Permission denied");
    }

    const company = await Company.findById(companyAdmin.companyId).select("employees");
    if (!company) {
      throw new Error("Failed to fire employer: Company not found");
    }

    const targetUser = await User.findById(targetUserId).select("role");
    if (!targetUser) {
      throw new Error("Failed to fire employer: Target user not found");
    }

    if (targetUser.role !== "employer") {
      throw new Error("Failed to fire employer: Target user is not an employer");
    }

    const employeeIndex = company.employees.indexOf(targetUserId);
    if (employeeIndex === -1) {
      throw new Error("Failed to fire employer: Target user is not part of this company");
    }

    company.employees.splice(employeeIndex, 1);
    await company.save();

    targetUser.role = "job_seeker";
    await targetUser.save();

    res.status(200).json({
      message: "Employer fired successfully",
      user: { userId: targetUserId, role: targetUser.role },
    });
  } catch (error) {
    console.error("Error firing employer:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to fire employer: An unexpected error occurred",
    });
  }
};

exports.createCompanyJob = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { title, description, location, jobType, salary, requirements, skills, experienceLevel, applicationDeadline } = req.body;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can create company jobs");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to create company job: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("Manage Company Jobs")) {
      throw new Error("Failed to create company job: Permission denied");
    }

    const company = await Company.findById(companyAdmin.companyId).select("jobListings");
    if (!company) {
      throw new Error("Failed to create company job: Company not found");
    }

    const newJob = new Job({
      title,
      description,
      location,
      jobType,
      salary,
      requirements,
      skills,
      experienceLevel,
      applicationDeadline,
      companyId: companyAdmin.companyId,
      postedBy: userId,
      status: "Open",
    });

    await newJob.save();

    company.jobListings.push(newJob._id);
    await company.save();

    res.status(201).json({
      message: "Company job created successfully",
      job: {
        jobId: newJob._id,
        title: newJob.title,
        location: newJob.location,
        jobType: newJob.jobType,
        salary: newJob.salary,
        experienceLevel: newJob.experienceLevel,
        status: newJob.status,
        createdAt: newJob.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating company job:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to create company job: An unexpected error occurred",
    });
  }
};

exports.updateCompanyJob = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;
    const updates = req.body;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can update company jobs");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to update company job: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("Manage Company Jobs")) {
      throw new Error("Failed to update company job: Permission denied");
    }

    const job = await Job.findOne({ _id: jobId, companyId: companyAdmin.companyId, isDeleted: false }).select("_id");
    if (!job) {
      throw new Error("Failed to update company job: Job not found or not associated with this company");
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

    res.status(200).json({
      message: "Company job updated successfully",
      job: {
        jobId: job._id,
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        experienceLevel: job.experienceLevel,
        status: job.status,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating company job:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to update company job: An unexpected error occurred",
    });
  }
};

exports.deleteCompanyJob = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can delete company jobs");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to delete company job: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("Manage Company Jobs")) {
      throw new Error("Failed to delete company job: Permission denied");
    }

    const job = await Job.findOne({ _id: jobId, companyId: companyAdmin.companyId }).select("_id");
    if (!job) {
      throw new Error("Failed to delete company job: Job not found or not associated with this company");
    }

    await job.softDelete();

    const company = await Company.findById(companyAdmin.companyId).select("jobListings");
    if (company) {
      company.jobListings = company.jobListings.filter((id) => id.toString() !== jobId.toString());
      await company.save();
    }

    res.status(200).json({
      message: "Company job deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting company job:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to delete company job: An unexpected error occurred",
    });
  }
};

exports.getCompanyReports = async (req, res) => {
  try {
    const { userId, role } = req.user;

    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can view company reports");

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.status !== "Active") {
      throw new Error("Failed to retrieve company reports: Company admin not found or inactive");
    }

    if (!companyAdmin.permissions.includes("View Company Reports")) {
      throw new Error("Failed to retrieve company reports: Permission denied");
    }

    const company = await Company.findById(companyAdmin.companyId).select("employees jobListings");
    if (!company) {
      throw new Error("Failed to retrieve company reports: Company not found");
    }

    const totalEmployees = company.employees.length;
    const totalJobs = await Job.countDocuments({ companyId: companyAdmin.companyId, isDeleted: false });

    const jobStats = await Job.aggregate([
      { $match: { companyId: companyAdmin.companyId, isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const applicationStats = await Job.aggregate([
      { $match: { companyId: companyAdmin.companyId, isDeleted: false } },
      { $unwind: "$applicants" },
      { $group: { _id: "$status", totalApplications: { $sum: 1 } } },
    ]);

    res.status(200).json({
      message: "Company reports retrieved successfully",
      reports: {
        totalEmployees,
        totalJobs,
        jobStats: jobStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}),
        applicationStats: applicationStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.totalApplications }), {}),
      },
    });
  } catch (error) {
    console.error("Error retrieving company reports:", error.message);
    res.status(error.status || 500).json({
      message: error.message || "Failed to retrieve company reports: An unexpected error occurred",
    });
  }
};