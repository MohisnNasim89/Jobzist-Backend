const User = require("../../models/user/Users");
const Job = require("../../models/job/Job");
const Company = require("../../models/company/Company");
const SuperAdmin = require("../../models/user/SuperAdmin");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const mongoose = require("mongoose");
const logger = require("../../utils/logger");
const { checkRole } = require("../../utils/checks");

exports.getAllUsers = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can view all users");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to retrieve users: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("manage_all_users")) {
      throw new Error("Failed to retrieve users: Permission denied");
    }

    const total = await User.countDocuments({ isDeleted: false, role: { $nin: ["super_admin"] } });
    const users = await User.find({ isDeleted: false, role: { $nin: ["super_admin"] } })
      .select("email role createdAt updatedAt")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      message: "Users retrieved successfully",
      users: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving users: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to retrieve users: An unexpected error occurred",
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { targetUserId } = req.params;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can delete users");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to delete user: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("manage_all_users")) {
      throw new Error("Failed to delete user: Permission denied");
    }

    const user = await User.findById(targetUserId)
      .select("_id")
      .lean();
    if (!user) {
      throw new Error("Failed to delete user: Target user not found");
    }

    await User.findByIdAndUpdate(targetUserId, { isDeleted: true });

    res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to delete user: An unexpected error occurred",
    });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can view all jobs");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to retrieve jobs: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("manage_all_jobs")) {
      throw new Error("Failed to retrieve jobs: Permission denied");
    }

    const total = await Job.countDocuments({ isDeleted: false });
    const jobs = await Job.find({ isDeleted: false })
      .select("title companyId location jobType salary experienceLevel status createdAt")
      .populate("companyId", "name logo")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      message: "Jobs retrieved successfully",
      jobs: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving jobs: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to retrieve jobs: An unexpected error occurred",
    });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { jobId } = req.params;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can delete jobs");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to delete job: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("manage_all_jobs")) {
      throw new Error("Failed to delete job: Permission denied");
    }

    const job = await Job.findById(jobId)
      .select("_id")
      .lean();
    if (!job) {
      throw new Error("Failed to delete job: Job not found");
    }

    await Job.findByIdAndUpdate(jobId, { isDeleted: true });

    res.status(200).json({
      message: "Job deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting job: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to delete job: An unexpected error occurred",
    });
  }
};

exports.getAllCompanies = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { page = 1, limit = 10 } = req.query;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can view all companies");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to retrieve companies: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("manage_all_companies")) {
      throw new Error("Failed to retrieve companies: Permission denied");
    }

    const total = await Company.countDocuments({ isDeleted: false });
    const companies = await Company.find({ isDeleted: false })
      .select("name logo location industry createdAt")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      message: "Companies retrieved successfully",
      companies: companies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving companies: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to retrieve companies: An unexpected error occurred",
    });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { companyId } = req.params;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can delete companies");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to delete company: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("manage_all_companies")) {
      throw new Error("Failed to delete company: Permission denied");
    }

    const company = await Company.findById(companyId)
      .select("_id")
      .lean();
    if (!company) {
      throw new Error("Failed to delete company: Company not found");
    }

    await Company.findByIdAndUpdate(companyId, { isDeleted: true });

    res.status(200).json({
      message: "Company deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting company: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to delete company: An unexpected error occurred",
    });
  }
};

exports.getSystemReports = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // Validate role
    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can view system reports");

    // Validate super admin
    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to retrieve system reports: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("view_system_reports")) {
      throw new Error("Failed to retrieve system reports: Permission denied");
    }

    // Date ranges for time-based metrics
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Total counts
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const totalJobs = await Job.countDocuments({ isDeleted: false });
    const totalCompanies = await Company.countDocuments({ isDeleted: false });
    const totalEmployers = await Employer.countDocuments({ isDeleted: false });
    const totalJobSeekers = await JobSeeker.countDocuments({ isDeleted: false });

    // User statistics
    const userStats = await User.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const recentRegistrations = await User.countDocuments({
      isDeleted: false,
      createdAt: { $gte: oneWeekAgo },
    });

    const deletedUsers = await User.countDocuments({ isDeleted: true });

    // Job statistics
    const jobStats = await Job.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const recentJobs = await Job.countDocuments({
      isDeleted: false,
      createdAt: { $gte: oneWeekAgo },
    });

    const totalApplications = await Job.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: "$applicants" },
      { $count: "total" },
    ]);

    const recentApplications = await Job.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: "$applicants" },
      { $match: { "applicants.appliedAt": { $gte: oneWeekAgo } } },
      { $count: "total" },
    ]);

    const totalHired = await Job.aggregate([
      { $match: { isDeleted: false } },
      { $unwind: "$hiredCandidates" },
      { $count: "total" },
    ]);

    const Companies = await Company.countDocuments({
      isDeleted: false,
      createdAt: { $gte: oneWeekAgo },
    });

    // Employer statistics
    const employerStats = await Employer.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$roleType", count: { $sum: 1 } } },
    ]);

    const activeEmployers = await Employer.countDocuments({
      isDeleted: false,
      status: "Active",
    });

    // Job Seeker statistics
    const jobSeekerStats = await JobSeeker.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const activeJobSeekers = await JobSeeker.countDocuments({
      isDeleted: false,
      status: "Open to Work",
    });

    // Time-based trends (e.g., new users per day over the last 30 days)
    const userTrends = await User.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: oneMonthAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const jobTrends = await Job.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: oneMonthAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

        // System health (optional: MongoDB stats, requires admin access)
    const dbStats = await mongoose.connection.db.stats();
    const dbSizeMB = (dbStats.dataSize / (1024 * 1024)).toFixed(2); // Convert bytes to MB

    res.status(200).json({
      message: "System reports retrieved successfully",
      reports: {
        overview: {
          totalUsers,
          totalJobs,
          totalCompanies,
          totalEmployers,
          totalJobSeekers,
          dbSizeMB,
        },
        userMetrics: {
          userStats: userStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}),
          recentRegistrations,
          deletedUsers,
          userTrends: userTrends.reduce((acc, trend) => ({ ...acc, [trend._id]: trend.count }), {}),
        },
        jobMetrics: {
          jobStats: jobStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}),
          recentJobs,
          totalApplications: totalApplications[0]?.total || 0,
          recentApplications: recentApplications[0]?.total || 0,
          totalHired: totalHired[0]?.total || 0,
          jobTrends: jobTrends.reduce((acc, trend) => ({ ...acc, [trend._id]: trend.count }), {}),
        },
        companyMetrics: {
          Companies,
        },
        employerMetrics: {
          employerStats: employerStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}),
          activeEmployers,
        },
        jobSeekerMetrics: {
          jobSeekerStats: jobSeekerStats.reduce((acc, stat) => ({ ...acc, [stat._id]: stat.count }), {}),
          activeJobSeekers,
        },
      },
    });
  } catch (error) {
    logger.error(`Error retrieving system reports: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to retrieve system reports: An unexpected error occurred",
    });
  }
};

exports.assignAdmin = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { targetUserId, adminType, permissions, companyId } = req.body;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can assign admins");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to assign admin: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("assign_admins")) {
      throw new Error("Failed to assign admin: Permission denied");
    }

    const targetUser = await User.findById(targetUserId)
      .select("role")
      .lean();
    if (!targetUser) {
      throw new Error("Failed to assign admin: Target user not found");
    }

    if (adminType === "super_admin") {
      let adminProfile = await SuperAdmin.findOne({ userId: targetUserId, isDeleted: false })
        .select("permissions")
        .lean();
      if (!adminProfile) {
        adminProfile = new SuperAdmin({
          userId: targetUserId,
          assignedBy: userId,
          permissions: permissions || [
            "manage_all_users",
            "manage_all_jobs",
            "manage_all_companies",
            "view_system_reports",
            "assign_admins",
            "remove_admins",
          ],
        });
      } else {
        adminProfile.permissions = permissions || adminProfile.permissions;
      }
      await adminProfile.save();
      await User.findByIdAndUpdate(targetUserId, { role: "super_admin" });
    } else if (adminType === "company_admin") {
      if (!companyId) {
        throw new Error("Failed to assign admin: Company ID is required for company admin");
      }
      const company = await Company.findById(companyId)
        .select("_id")
        .lean();
      if (!company) {
        throw new Error("Failed to assign admin: Company not found");
      }
      let adminProfile = await CompanyAdmin.findOne({ userId: targetUserId, isDeleted: false })
        .select("permissions companyId")
        .lean();
      if (!adminProfile) {
        adminProfile = new CompanyAdmin({
          userId: targetUserId,
          companyId,
          assignedBy: userId,
          permissions: permissions || [
            "Manage Company Users",
            "Manage Company Jobs",
            "Fire Employers",
            "View Company Reports",
          ],
        });
      } else {
        adminProfile.companyId = companyId;
        adminProfile.permissions = permissions || adminProfile.permissions;
      }
      await adminProfile.save();
      await User.findByIdAndUpdate(targetUserId, { role: "company_admin" });
    } else {
      throw new Error("Failed to assign admin: Invalid admin type");
    }

    res.status(200).json({
      message: "Admin assigned successfully",
      admin: {
        userId: targetUserId,
        role: adminType === "super_admin" ? "super_admin" : "company_admin",
        adminType,
      },
    });
  } catch (error) {
    logger.error(`Error assigning admin: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to assign admin: An unexpected error occurred",
    });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { targetUserId } = req.params;

    checkRole(role, ["super_admin"], "Unauthorized: Only super admins can remove admins");

    const superAdmin = await SuperAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!superAdmin || superAdmin.status !== "active") {
      throw new Error("Failed to remove admin: Super admin not found or inactive");
    }

    if (!superAdmin.permissions.includes("remove_admins")) {
      throw new Error("Failed to remove admin: Permission denied");
    }

    const targetUser = await User.findById(targetUserId)
      .select("role")
      .lean();
    if (!targetUser) {
      throw new Error("Failed to remove admin: Target user not found");
    }

    if (targetUser.role === "super_admin") {
      const adminProfile = await SuperAdmin.findOne({ userId: targetUserId, isDeleted: false })
        .select("_id")
        .lean();
      if (adminProfile) {
        await SuperAdmin.findByIdAndUpdate(adminProfile._id, { isDeleted: true });
      }
    } else if (targetUser.role === "company_admin") {
      const adminProfile = await CompanyAdmin.findOne({ userId: targetUserId, isDeleted: false })
        .select("_id")
        .lean();
      if (adminProfile) {
        await CompanyAdmin.findByIdAndUpdate(adminProfile._id, { isDeleted: true });
      }
    } else {
      throw new Error("Failed to remove admin: Target user is not an admin");
    }

    await User.findByIdAndUpdate(targetUserId, { role: "job_seeker" });

    res.status(200).json({
      message: "Admin removed successfully",
      user: { userId: targetUserId, role: "job_seeker" },
    });
  } catch (error) {
    logger.error(`Error removing admin: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "Failed to remove admin: An unexpected error occurred",
    });
  }
};

exports.clearLogs = async (req, res) => {
  try {
    checkRole(req.user.role, ["super_admin"], "Only super admins can clear logs");
    await logger.clearLogs();
    res.status(200).json({ message: "Logs cleared successfully" });
  } catch (error) {
    logger.error(`Error clearing logs via API: ${error.message}`);
    res.status(500).json({ message: "Failed to clear logs" });
  }
};