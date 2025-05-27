const mongoose = require("mongoose");
const User = require("../../models/user/Users");
const Job = require("../../models/job/Job");
const logger = require("../../utils/logger");
const Company = require("../../models/company/Company");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const Employer = require("../../models/user/Employer");
const Notification = require("../models/notification/Notification");
const { checkCompanyExists } = require("../../utils/checks");
const { emitNotification } = require("../socket");

exports.approveCompanyEmployer = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId, employerId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).lean();
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId) {
      throw new Error("Unauthorized: You can only approve employers for your own company");
    }

    const company = await checkCompanyExists(companyId);

    const employer = await Employer.findById(employerId);
    if (!employer) throw new Error("Employer not found");
    if (employer.roleType !== "Company Employer") throw new Error("This endpoint is only for approving Company Employers");
    if (employer.status !== "Pending") throw new Error("Employer is not in a pending state");
    if (employer.companyId.toString() !== companyId) throw new Error("Employer is not associated with this company");

    employer.status = "Active";
    await employer.save();

    company.employees = company.employees || [];
    if (!company.employees.some(id => id.toString() === employer.userId.toString())) {
      company.employees.push(employer.userId);
      await company.save();
    }

    const notification = new Notification({
      userId: employer.userId,
      type: "employerApproval",
      relatedId: employer._id,
      message: `Your request to join ${company.name} as a Company Employer has been approved.`,
    });
    await notification.save();
    emitNotification(employer.userId, notification);

    res.status(200).json({
      message: "Company employer approved successfully",
      employer: {
        userId: employer.userId,
        roleType: employer.roleType,
        companyId: employer.companyId,
        companyName: employer.companyName,
        status: employer.status,
      },
    });
  } catch (error) {
    logger.error(`Error approving company employer: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanyEmployerApprovalRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const approvalRequests = await Employer.find({
      companyId: companyAdmin.companyId,
      roleType: "Company Employer",
      status: "Pending",
      isDeleted: false,
    })
      .select("userId companyId companyName status createdAt")
      .populate({
        path: "userId",
        select: "email",
        match: { isDeleted: false },
      })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalRequests = await Employer.countDocuments({
      companyId: companyAdmin.companyId,
      roleType: "Company Employer",
      status: "Pending",
      isDeleted: false,
    });

    const filteredRequests = approvalRequests.filter(request => request.userId);

    res.status(200).json({
      message: "Company employer approval requests retrieved successfully",
      approvalRequests: filteredRequests.map(request => ({
        employerId: request._id,
        userId: request.userId._id,
        email: request.userId.email,
        companyId: request.companyId,
        companyName: request.companyName,
        status: request.status,
        createdAt: request.createdAt,
      })),
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalRequests,
    });
  } catch (error) {
    logger.error(`Error retrieving company employer approval requests: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.getCompanyUsers = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const company = await Company.findById(companyAdmin.companyId)
      .select("employees")
      .lean();
    if (!company) {
      throw new Error("Company not found");
    }

    const users = await User.find({ _id: { $in: company.employees }, isDeleted: false })
      .select("email role")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalUsers = await User.countDocuments({
      _id: { $in: company.employees },
      isDeleted: false,
    });

    res.status(200).json({
      message: "Company users retrieved successfully",
      users,
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalUsers,
    });
  } catch (error) {
    logger.error(`Error retrieving company users: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.assignCompanyUserRole = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId, newRole } = req.body;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const company = await Company.findById(companyAdmin.companyId)
      .select("employees")
      .lean();
    if (!company) {
      throw new Error("Company not found");
    }

    if (!company.employees.some((id) => id.toString() === targetUserId.toString())) {
      throw new Error("Target user is not part of this company");
    }

    const targetUser = await User.findById(targetUserId).select("role");
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    const validRoles = ["job_seeker", "employer"];
    if (!validRoles.includes(newRole)) {
      throw new Error("Invalid role specified");
    }

    targetUser.role = newRole;
    await targetUser.save();

    // Notify the target user of the role change
    const companyName = (await Company.findById(companyAdmin.companyId).select("name")).name;
    const notification = new Notification({
      userId: targetUserId,
      type: "employerApproval",
      relatedId: targetUser._id,
      message: `Your role at ${companyName} has been updated to ${newRole}.`,
    });
    await notification.save();
    emitNotification(targetUserId, notification);

    res.status(200).json({
      message: "Company user role assigned successfully",
      user: { userId: targetUserId, role: newRole },
    });
  } catch (error) {
    logger.error(`Error assigning company user role: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.fireEmployer = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const company = await Company.findById(companyAdmin.companyId).select("employees");
    if (!company) {
      throw new Error("Company not found");
    }

    const targetUser = await User.findById(targetUserId).select("role");
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.role !== "employer") {
      throw new Error("Target user is not an employer");
    }

    const employeeIndex = company.employees.findIndex(
      (id) => id.toString() === targetUserId.toString()
    );
    if (employeeIndex === -1) {
      throw new Error("Target user is not part of this company");
    }

    company.employees.splice(employeeIndex, 1);
    await company.save();

    targetUser.role = "employer";

    employerProfile = await Employer.findOne({ userId: targetUserId, isDeleted: false });
    employerProfile.roleType = "Independent Recruiter";
    employerProfile.companyId = null;
    employerProfile.companyName = null;

    await targetUser.save();

    const companyName = (await Company.findById(companyAdmin.companyId).select("name")).name;
    const notification = new Notification({
      userId: targetUserId,
      type: "employerApproval",
      relatedId: targetUser._id,
      message: `You have been removed from your employer role at ${companyName}. Your role is now job_seeker.`,
    });
    await notification.save();
    emitNotification(targetUserId, notification);

    res.status(200).json({
      message: "Employer fired successfully",
      user: { userId: targetUserId, role: targetUser.role },
    });
  } catch (error) {
    logger.error(`Error firing employer: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.createCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
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
    } = req.body;

    const requiredFields = [
      "title",
      "description",
      "location",
      "jobType",
      "salary",
      "experienceLevel",
      "applicationDeadline",
    ];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const deadline = new Date(applicationDeadline);
    if (deadline <= new Date()) {
      throw new Error("Application deadline must be in the future");
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const company = await Company.findById(companyAdmin.companyId).select("jobListings employees");
    if (!company) {
      throw new Error("Company not found");
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

    const notification = new Notification({
      userId: null,
      type: "newJob",
      relatedId: newJob._id,
      message: `A new job "${title}" has been posted at ${company.name}.`,
    });
    for (const employeeId of company.employees) {
      const employeeNotification = new Notification({
        ...notification.toObject(),
        userId: employeeId,
      });
      await employeeNotification.save();
      emitNotification(employeeId, employeeNotification);
    }

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
    logger.error(`Error creating company job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.getCompanyJobs = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const jobs = await Job.find({ companyId: companyAdmin.companyId, isDeleted: false })
      .select("title location jobType salary experienceLevel status createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalJobs = await Job.countDocuments({
      companyId: companyAdmin.companyId,
      isDeleted: false,
    });

    res.status(200).json({
      message: "Company jobs retrieved successfully",
      jobs: jobs.map((job) => ({
        jobId: job._id,
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        experienceLevel: job.experienceLevel,
        status: job.status,
        createdAt: job.createdAt,
      })),
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalJobs,
    });
  } catch (error) {
    logger.error(`Error retrieving company jobs: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.updateCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
    const { jobId } = req.params;
    const updates = req.body;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const job = await Job.findOne({
      _id: jobId,
      companyId: companyAdmin.companyId,
      isDeleted: false,
    }).select("_id companyId title location jobType salary experienceLevel status updatedAt");
    if (!job) {
      throw new Error("Job not found or not associated with this company");
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

    if (updates.applicationDeadline) {
      const deadline = new Date(updates.applicationDeadline);
      if (deadline <= new Date()) {
        throw new Error("Application deadline must be in the future");
      }
    }

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
    logger.error(`Error updating company job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.deleteCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
    const { jobId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const job = await Job.findOne({ _id: jobId, companyId: companyAdmin.companyId })
      .select("_id companyId")
      .lean();
    if (!job) {
      throw new Error("Job not found or not associated with this company");
    }

    await Job.findById(jobId).then((job) => job.softDelete());

    const company = await Company.findById(companyAdmin.companyId).select("jobListings");
    if (company) {
      company.jobListings = company.jobListings.filter(
        (id) => id.toString() !== jobId.toString()
      );
      await company.save();
    }

    res.status(200).json({
      message: "Company job deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting company job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.getCompanyReports = async (req, res) => {
  try {
    const { userId } = req.user;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("companyId")
      .lean();
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }

    const company = await Company.findById(companyAdmin.companyId)
      .select("employees jobListings")
      .lean();
    if (!company) {
      throw new Error("Company not found");
    }

    const totalEmployees = company.employees.length;

    const stats = await Job.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyAdmin.companyId), isDeleted: false } },
      { $facet: {
          jobStats: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],
          applicationStats: [
            { $unwind: { path: "$applicants", preserveNullAndEmptyArrays: true } },
            { $match: { "applicants": { $exists: true } } },
            { $group: { _id: "$status", totalApplications: { $sum: 1 } } },
          ],
          totalJobs: [
            { $count: "count" },
          ],
        },
      },
    ]);

    const totalJobs = stats[0].totalJobs[0]?.count || 0;
    const jobStats = stats[0].jobStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {});
    const applicationStats = stats[0].applicationStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.totalApplications }), {});

    res.status(200).json({
      message: "Company reports retrieved successfully",
      reports: {
        totalEmployees,
        totalJobs,
        jobStats,
        applicationStats,
      },
    });
  } catch (error) {
    logger.error(`Error retrieving company reports: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};