const mongoose = require("mongoose");
const User = require("../../models/user/Users");
const Job = require("../../models/job/Job");
const logger = require("../../utils/logger");
const Company = require("../../models/company/Company");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const Employer = require("../../models/user/Employer");
const { checkCompanyExists } = require("../../utils/checks");
const { sendNotification, sendNotificationsToUsers } = require("../../utils/notification");

exports.getCompanyEmployerApprovalRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId) {
      return res.status(403).json({ message: "Unauthorized: You can only view employers for your own company" });
    }

    const approvalRequests = await Employer.find({
      companyId: companyId,
      roleType: "Company Employer",
      status: "Pending",
      isDeleted: false,
    })
      .select("_id userId companyId companyName status createdAt")
      .populate({
        path: "userId",
        select: "email",
        match: { isDeleted: false },
        populate: { path: "profileId", select: "fullName", match: { isDeleted: false } },
      })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalRequests = await Employer.countDocuments({
      companyId: companyId,
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
        employeeName: request.userId.profileId?.fullName || "Unknown",
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
    res.status(500).json({ message: error.message });
  }
};

exports.getCompanyEmployerApproval = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId, employerId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId) {
      return res.status(403).json({ message: "Unauthorized: You can only view employers for your own company" });
    }

    const employer = await Employer.findOne({ _id: employerId, isDeleted: false })
      .populate({
        path: "userId",
        select: "email",
        match: { isDeleted: false },
        populate: { path: "profileId", select: "fullName", match: { isDeleted: false } },
      })
      .lean();
    if (!employer) return res.status(404).json({ message: "Employer not found" });
    if (employer.roleType !== "Company Employer") return res.status(400).json({ message: "This endpoint is only for viewing Company Employers" });
    if (employer.status !== "Pending") return res.status(400).json({ message: "Employer is not in a pending state" });
    if (employer.companyId.toString() !== companyId) return res.status(400).json({ message: "Employer is not associated with this company" });

    res.status(200).json({
      message: "Employer approval details retrieved successfully",
      employer: {
        employerId: employer._id,
        userId: employer.userId._id,
        email: employer.userId.email,
        employeeName: employer.userId.profileId?.fullName || "Unknown",
        roleType: employer.roleType,
        companyId: employer.companyId,
        companyName: employer.companyName,
        status: employer.status,
        createdAt: employer.createdAt,
      },
    });
  } catch (error) {
    logger.error(`Error retrieving employer approval details: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.approveCompanyEmployer = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId, employerId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId) {
      return res.status(403).json({ message: "Unauthorized: You can only approve employers for your own company" });
    }

    const company = await checkCompanyExists(companyId);
    const employer = await Employer.findOne({ _id: employerId, isDeleted: false })
      .populate({
        path: "userId",
        select: "email",
        match: { isDeleted: false },
        populate: { path: "profileId", select: "fullName", match: { isDeleted: false } },
      });
    if (!employer) return res.status(404).json({ message: "Employer not found" });
    if (employer.roleType !== "Company Employer") return res.status(400).json({ message: "This endpoint is only for approving Company Employers" });
    if (employer.status !== "Pending") return res.status(400).json({ message: "Employer is not in a pending state" });
    if (employer.companyId.toString() !== companyId) return res.status(400).json({ message: "Employer is not associated with this company" });

    const user = await User.findById(employer.userId).select("role");
    if (!user) return res.status(404).json({ message: "Associated user not found" });
    if (user.role !== "employer") {
      user.role = "employer";
      await user.save();
      logger.info(`Updated user ${employer.userId} role to employer`);
    }

    employer.status = "Active";
    await employer.save();
    logger.info(`Updated employer ${employerId} status to Active`);

    const updateResult = await Company.findOneAndUpdate(
      { _id: companyId, "companyEmployees.userId": { $ne: employer.userId } },
      { $push: { companyEmployees: { userId: employer.userId, status: "Active" } } },
      { new: true, runValidators: true }
    );

    if (updateResult) {
      logger.info(`Added user ${employer.userId} to companyEmployees for company ${companyId} during approval`);
    } else {
      await Company.findOneAndUpdate(
        { _id: companyId, "companyEmployees.userId": employer.userId },
        { $set: { "companyEmployees.$[elem].status": "Active" } },
        { arrayFilters: [{ "elem.userId": employer.userId }], new: true, runValidators: true }
      );
      logger.info(`Updated status to Active for user ${employer.userId} in companyEmployees for company ${companyId}`);
    }

    await sendNotification({
      userId: employer.userId,
      type: "employerApproval",
      relatedId: employer._id,
      message: `Your request to join ${company.name} as a Company Employer has been approved.`,
    });

    res.status(200).json({
      message: "Company employer approved successfully",
      employer: {
        employerId: employer._id,
        userId: employer.userId._id,
        email: employer.userId.email,
        employeeName: employer.userId.profileId?.fullName || "Unknown",
        roleType: employer.roleType,
        companyId: employer.companyId,
        companyName: employer.companyName,
        status: employer.status,
      },
    });
  } catch (error) {
    logger.error(`Error approving company employer: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while approving the company employer",
    });
  }
};

exports.getCompanyUsers = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const company = await Company.findById(companyAdmin.companyId).select("companyEmployees").lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    const userIds = company.companyEmployees.map(emp => emp.userId);
    const users = await User.find({ _id: { $in: userIds }, isDeleted: false })
      .select("_id email role")
      .populate({ path: "profileId", select: "fullName", match: { isDeleted: false } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalUsers = await User.countDocuments({
      _id: { $in: userIds },
      isDeleted: false,
    });

    res.status(200).json({
      message: "Company users retrieved successfully",
      users: users.map(user => {
        const employeeEntry = company.companyEmployees.find(emp => emp.userId.toString() === user._id.toString());
        return {
          employeeId: employeeEntry ? employeeEntry._id : null,
          userId: user._id,
          employeeName: user.profileId?.fullName || "Unknown",
          email: user.email,
          role: user.role,
        };
      }),
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalUsers,
    });
  } catch (error) {
    logger.error(`Error retrieving company users: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanyUser = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const company = await Company.findById(companyAdmin.companyId).select("companyEmployees").lean();
    if (!company || !company.companyEmployees.some(emp => emp.userId.toString() === targetUserId)) {
      return res.status(404).json({ message: "User not found in company" });
    }

    const user = await User.findById(targetUserId)
      .select("email role")
      .populate({ path: "profileId", select: "fullName", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } })
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const employeeEntry = company.companyEmployees.find(emp => emp.userId.toString() === targetUserId);

    res.status(200).json({
      message: "Company user details retrieved successfully",
      user: {
        employeeId: employeeEntry ? employeeEntry._id : null,
        userId: user._id,
        employeeName: user.profileId?.fullName || "Unknown",
        email: user.email,
        role: user.role,
        profile: user.profileId || {},
        roleSpecificData: user.roleSpecificData || {},
      },
    });
  } catch (error) {
    logger.error(`Error retrieving company user details: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.assignCompanyUserRole = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId, newRole } = req.body;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const company = await Company.findById(companyAdmin.companyId).select("companyEmployees name").lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    if (!company.companyEmployees.some(emp => emp.userId.toString() === targetUserId.toString())) {
      return res.status(404).json({ message: "Target user is not part of this company" });
    }

    const targetUser = await User.findOne({ _id: targetUserId, isDeleted: false })
      .select("role")
      .populate({ path: "profileId", select: "fullName", match: { isDeleted: false } });
    if (!targetUser) return res.status(404).json({ message: "Target user not found" });

    const validRoles = ["job_seeker", "employer"];
    if (!validRoles.includes(newRole)) return res.status(400).json({ message: "Invalid role specified" });

    targetUser.role = newRole;
    await targetUser.save();

    let employer;
    if (newRole === "employer") {
      employer = await Employer.findOne({ userId: targetUserId, isDeleted: false });
      if (!employer) {
        employer = new Employer({
          userId: targetUserId,
          roleType: "Company Employer",
          companyId: companyAdmin.companyId,
          companyName: company.name,
          status: "Active",
        });
        await employer.save();
      } else {
        employer.roleType = "Company Employer";
        employer.companyId = companyAdmin.companyId;
        employer.companyName = company.name;
        employer.status = "Active";
        await employer.save();
      }
    } else {
      employer = await Employer.findOne({ userId: targetUserId, isDeleted: false });
      if (employer) {
        employer.roleType = "Independent Recruiter";
        employer.companyId = null;
        employer.companyName = null;
        employer.status = "Active";
        await employer.save();
      }
    }

    await sendNotification({
      userId: targetUserId,
      type: "employerApproval",
      relatedId: targetUser._id,
      message: `Your role at ${company.name} has been updated to ${newRole}.`,
    });

    res.status(200).json({
      message: "Company user role assigned successfully",
      user: {
        userId: targetUserId,
        employeeName: targetUser.profileId?.fullName || "Unknown",
        role: newRole,
      },
    });
  } catch (error) {
    logger.error(`Error assigning company user role: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.fireEmployer = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const company = await Company.findById(companyAdmin.companyId).select("companyEmployees name");
    if (!company) return res.status(404).json({ message: "Company not found" });

    const targetUser = await User.findOne({ _id: targetUserId, isDeleted: false })
      .select("role")
      .populate({ path: "profileId", select: "fullName", match: { isDeleted: false } });
    if (!targetUser) return res.status(404).json({ message: "Target user not found" });
    if (targetUser.role !== "employer") return res.status(400).json({ message: "Target user is not an employer" });

    const employeeIndex = company.companyEmployees.findIndex(emp => emp.userId.toString() === targetUserId.toString());
    if (employeeIndex === -1) return res.status(400).json({ message: "Target user is not part of this company" });

    company.companyEmployees.splice(employeeIndex, 1);
    await company.save();

    targetUser.role = "job_seeker";
    await targetUser.save();

    const employerProfile = await Employer.findOne({ userId: targetUserId, isDeleted: false });
    if (employerProfile) {
      employerProfile.roleType = "Independent Recruiter";
      employerProfile.companyId = null;
      employerProfile.companyName = null;
      employerProfile.status = "Active";
      await employerProfile.save();
    }

    await sendNotification({
      userId: targetUserId,
      type: "employerApproval",
      relatedId: targetUser._id,
      message: `You have been removed from your employer role at ${company.name}. Your role is now job_seeker.`,
    });

    res.status(200).json({
      message: "Employer fired successfully",
      user: {
        userId: targetUserId,
        employeeName: targetUser.profileId?.fullName || "Unknown",
        role: targetUser.role,
      },
    });
  } catch (error) {
    logger.error(`Error firing employer: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.createCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
    const { title, description, location, jobType, salary, requirements, skills, experienceLevel, applicationDeadline } = req.body;

    const requiredFields = ["title", "description", "location", "jobType", "salary", "experienceLevel", "applicationDeadline"];
    for (const field of requiredFields) {
      if (!req.body[field]) return res.status(400).json({ message: `Missing required field: ${field}` });
    }

    const deadline = new Date(applicationDeadline);
    if (deadline <= new Date()) return res.status(400).json({ message: "Application deadline must be in the future" });

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const company = await Company.findById(companyAdmin.companyId).select("jobListings companyEmployees name");
    if (!company) return res.status(404).json({ message: "Company not found" });

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

    company.jobListings.push({ jobId: newJob._id });
    await company.save();

    const employeeIds = company.companyEmployees.map(emp => emp.userId);
    await sendNotificationsToUsers({
      userIds: employeeIds,
      type: "newJob",
      relatedId: newJob._id,
      message: `A new job "${title}" has been posted at ${company.name}.`,
    });

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
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanyJobs = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const jobs = await Job.find({ companyId: companyAdmin.companyId, isDeleted: false })
      .select("_id title location jobType status createdAt")
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
      jobs: jobs.map(job => ({
        jobId: job._id,
        title: job.title,
        location: job.location,
        jobType: job.jobType,
        status: job.status,
        createdAt: job.createdAt,
      })),
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalJobs,
    });
  } catch (error) {
    logger.error(`Error retrieving company jobs: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
    const { jobId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const job = await Job.findOne({ _id: jobId, companyId: companyAdmin.companyId, isDeleted: false }).lean();
    if (!job) return res.status(404).json({ message: "Job not found or not associated with this company" });

    res.status(200).json({
      message: "Company job details retrieved successfully",
      job,
    });
  } catch (error) {
    logger.error(`Error retrieving company job details: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.updateCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
    const { jobId } = req.params;
    const updates = req.body;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const job = await Job.findOne({ _id: jobId, companyId: companyAdmin.companyId, isDeleted: false });
    if (!job) return res.status(404).json({ message: "Job not found or not associated with this company" });

    const allowedUpdates = ["title", "description", "location", "jobType", "salary", "requirements", "skills", "experienceLevel", "applicationDeadline", "status"];
    if (updates.applicationDeadline) {
      const deadline = new Date(updates.applicationDeadline);
      if (deadline <= new Date()) return res.status(400).json({ message: "Application deadline must be in the future" });
    }

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        job[key] = updates[key];
      }
    });
    await job.save();

    const company = await Company.findById(companyAdmin.companyId).select("companyEmployees name");
    const employeeIds = company.companyEmployees.map(emp => emp.userId);
    await sendNotificationsToUsers({
      userIds: employeeIds,
      type: "newJob",
      relatedId: job._id,
      message: `The job "${job.title}" has been updated at ${company.name}.`,
    });

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
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.deleteCompanyJob = async (req, res) => {
  try {
    const { userId } = req.user;
    const { jobId } = req.params;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const job = await Job.findOne({ _id: jobId, companyId: companyAdmin.companyId });
    if (!job) return res.status(404).json({ message: "Job not found or not associated with this company" });

    await job.softDelete();

    const company = await Company.findById(companyAdmin.companyId).select("jobListings companyEmployees name");
    company.jobListings = company.jobListings.filter(item => item.jobId.toString() !== jobId.toString());
    await company.save();

    const employeeIds = company.companyEmployees.map(emp => emp.userId);
    await sendNotificationsToUsers({
      userIds: employeeIds,
      type: "newJob",
      relatedId: job._id,
      message: `The job "${job.title}" has been deleted from ${company.name}.`,
    });

    res.status(200).json({
      message: "Company job deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting company job: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanyReports = async (req, res) => {
  try {
    const { userId } = req.user;

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false }).select("companyId").lean();
    if (!companyAdmin) return res.status(404).json({ message: "Company admin not found" });

    const company = await Company.findById(companyAdmin.companyId).select("companyEmployees jobListings name").lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    const totalEmployees = company.companyEmployees.length;

    // Fetch employee names and employer details
    const userIds = company.companyEmployees.map(emp => emp.userId);
    const users = await User.find({ _id: { $in: userIds }, isDeleted: false })
      .select("_id")
      .populate({ path: "profileId", select: "fullName", match: { isDeleted: false } })
      .lean();

    const employeeDetails = await Promise.all(
      company.companyEmployees.map(async (emp) => {
        const user = users.find(u => u._id.toString() === emp.userId.toString());
        let employer = await Employer.findOne({ userId: emp.userId, isDeleted: false }).lean();
        if (!employer && user?.role === "employer") {
          employer = new Employer({
            userId: emp.userId,
            roleType: "Company Employer",
            companyId: companyAdmin.companyId,
            companyName: company.name,
            status: "Active",
          });
          await employer.save();
          logger.info(`Created missing Employer document for userId: ${emp.userId}`);
        }
        return {
          employeeId: emp._id,
          userId: emp.userId,
          employeeName: user?.profileId?.fullName || "Unknown",
          employerStatus: employer?.status || "N/A",
        };
      })
    );

    // Employer Statistics
    const employerStats = await Employer.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyAdmin.companyId),
          roleType: "Company Employer",
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [
            { $match: { isDeleted: false } },
            {
              $lookup: {
                from: "userprofiles",
                localField: "profileId",
                foreignField: "_id",
                as: "profile",
                pipeline: [{ $match: { isDeleted: false } }],
              },
            },
            { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
          ],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          employerStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          totalEmployers: [{ $count: "count" }],
          employerDetails: [
            {
              $project: {
                employerId: "$_id",
                userId: "$userId",
                employeeName: "$user.profile.fullName",
                status: "$status",
              },
            },
          ],
          tenureStats: [
            { $unwind: { path: "$hiredCandidates", preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: null,
                totalHires: { $sum: { $cond: [{ $ifNull: ["$hiredCandidates.hiredAt", false] }, 1, 0] } },
                totalTenureDays: {
                  $sum: {
                    $cond: [
                      { $ifNull: ["$hiredCandidates.hiredAt", false] },
                      { $divide: [{ $subtract: [new Date(), "$hiredCandidates.hiredAt"] }, 1000 * 60 * 60 * 24] },
                      0,
                    ],
                  },
                },
              },
            },
            {
              $project: {
                averageTenureDays: { $cond: [{ $eq: ["$totalHires", 0] }, 0, { $divide: ["$totalTenureDays", "$totalHires"] }] },
              },
            },
          ],
        },
      },
    ]);

    const totalEmployers = employerStats[0]?.totalEmployers[0]?.count || 0;
    const employerStatus = employerStats[0]?.employerStatus?.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}) || {};
    const employerDetails = employerStats[0]?.employerDetails || [];
    const averageTenureDays = employerStats[0]?.tenureStats[0]?.averageTenureDays || 0;

    // Job Statistics
    const jobStats = await Job.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyAdmin.companyId), isDeleted: false } },
      {
        $facet: {
          jobStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          applicationStats: [
            { $unwind: { path: "$applicants", preserveNullAndEmptyArrays: true } },
            { $match: { "applicants": { $exists: true } } },
            { $group: { _id: "$status", totalApplications: { $sum: 1 } } },
          ],
          totalJobs: [{ $count: "count" }],
          salaryStats: [
            {
              $group: {
                _id: null,
                totalSalary: { $sum: "$salary" },
                jobCount: { $sum: 1 },
              },
            },
            {
              $project: {
                averageSalary: { $cond: [{ $eq: ["$jobCount", 0] }, 0, { $divide: ["$totalSalary", "$jobCount"] }] },
              },
            },
          ],
          experienceLevelStats: [{ $group: { _id: "$experienceLevel", count: { $sum: 1 } } }],
          jobTypeStats: [{ $group: { _id: "$jobType", count: { $sum: 1 } } }],
          jobsPerMonth: [
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            {
              $sort: { "_id.year": 1, "_id.month": 1 },
            },
            {
              $project: {
                period: {
                  $concat: [
                    { $toString: "$_id.year" },
                    "-",
                    { $toString: "$_id.month" },
                  ],
                },
                count: 1,
                _id: 0,
              },
            },
          ],
        },
      },
    ]);

    const totalJobs = jobStats[0]?.totalJobs[0]?.count || 0;
    const jobStatus = jobStats[0]?.jobStatus?.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}) || {};
    const applicationStats = jobStats[0]?.applicationStats?.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.totalApplications }), {}) || {};
    const averageSalary = jobStats[0]?.salaryStats[0]?.averageSalary || 0;
    const experienceLevelStats = jobStats[0]?.experienceLevelStats?.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}) || {};
    const jobTypeStats = jobStats[0]?.jobTypeStats?.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}) || {};
    const jobsPerMonth = jobStats[0]?.jobsPerMonth?.reduce((acc, stat) => ({ ...acc, [stat.period]: stat.count }), {}) || {};

    res.status(200).json({
      message: "Company reports retrieved successfully",
      reports: {
        totalEmployees,
        employeeDetails,
        employerStats: {
          totalEmployers,
          employerStatus,
          employerDetails: employerDetails.map(detail => ({
            employerId: detail.employerId,
            userId: detail.userId,
            employeeName: detail.employeeName || "Unknown",
            status: detail.status,
          })),
          averageTenureDays: Math.round(averageTenureDays),
        },
        jobStats: {
          totalJobs,
          jobStatus,
          applicationStats,
          averageSalary: Math.round(averageSalary),
          experienceLevelStats,
          jobTypeStats,
          jobsPerMonth,
        },
      },
    });
  } catch (error) {
    logger.error(`Error retrieving company reports: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};