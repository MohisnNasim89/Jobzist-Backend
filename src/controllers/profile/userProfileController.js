const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const Company = require("../../models/company/Company");
const logger = require("../../utils/logger");
const Notification = require("../../models/notification/Notification");
const { checkUserExists, checkUserIdMatch, checkUserProfileExists, renderProfileWithFallback } = require("../../utils/checks");
const { emitNotification } = require("../../socket/socket");

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const total = await User.countDocuments({ isDeleted: false });
    const users = await User.find({ isDeleted: false })
      .select("_id role profileId")
      .populate({ path: "profileId", select: "fullName location.city profilePicture", match: { isDeleted: false } })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const userList = users.map(user => ({
      userId: user._id,
      fullName: user.profileId?.fullName || "Unnamed User",
      role: user.role || "Unknown",
      city: user.profileId?.location?.city || "Unknown",
      profilePicture: user.profileId?.profilePicture || "Not provided",
    }));

    return res.status(200).json({
      message: "Users retrieved successfully",
      users: userList,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error retrieving users: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving users",
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only access your own profile");

    const user = await User.findOne({ _id: userId, isDeleted: false })
      .select("authId email role profileId roleSpecificData")
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } })
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    const profileData = renderProfileWithFallback(user, "user", {
      authId: user.authId,
      email: user.email,
      role: user.role,
      profile: user.profileId || {},
      roleSpecificData: user.roleSpecificData || {},
    });

    return res.status(200).json({
      message: "User profile retrieved successfully",
      profile: profileData,
    });
  } catch (error) {
    logger.error(`Error retrieving user profile: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the user profile",
    });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only update your own profile");
    const user = await checkUserExists(userId);
    logger.info(`User found: ${userId}`);

    const updates = req.body;
    logger.info(`Updates received: ${JSON.stringify(updates)}`);

    const role = user.role;
    logger.info(`User role: ${role}`);

    const userProfile = await checkUserProfileExists(userId);
    logger.info(`User profile found: ${JSON.stringify(userProfile)}`);

    const allowedProfileUpdates = [
      "fullName",
      "bio",
      "location",
      "phoneNumber",
      "socialLinks",
      "profilePicture",
    ];
    const profileUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedProfileUpdates.includes(key)) {
        profileUpdates[key] = updates[key];
      }
    });

    // Since userProfile is a plain object (from lean), use its _id for the update
    if (Object.keys(profileUpdates).length > 0) {
      await UserProfile.findByIdAndUpdate(userProfile._id, profileUpdates);
      logger.info(`User profile updated for userId: ${userId}`);
    }

    const roleSpecificModels = {
      job_seeker: {
        model: JobSeeker,
        allowedUpdates: [
          "resume",
          "skills",
          "education",
          "experience",
          "projects",
          "jobPreferences",
          "status",
        ],
      },
      employer: {
        model: Employer,
        allowedUpdates: [
          "roleType",
          "companyId",
          "companyName",
          "status",
        ],
      },
      company_admin: {
        model: CompanyAdmin,
        allowedUpdates: ["companyId", "permissions", "status"],
      },
    };

    if (roleSpecificModels[role]) {
      const { model: RoleSpecificModel, allowedUpdates } = roleSpecificModels[role];
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false }).select("_id");
      if (!roleSpecificData) {
        if (role === "employer") {
          const { roleType, companyId } = updates;
          const employerData = { userId };
          if (roleType === "Independent Recruiter") {
            employerData.roleType = "Independent Recruiter";
            employerData.status = "Active";
          } else if (roleType === "Company Employer") {
            if (!companyId) {
              throw new Error("companyId is required for Company Employer");
            }
            const company = await Company.findById(companyId);
            if (!company) throw new Error("Company not found");
            employerData.roleType = "Company Employer";
            employerData.companyId = companyId;
            employerData.companyName = company.name;
            employerData.status = "Pending";

            const companyAdmins = await CompanyAdmin.find({ companyId, isDeleted: false }).select("userId");
            const notification = new Notification({
              userId: null,
              type: "employerApprovalRequest",
              relatedId: userProfile._id,
              message: `${userProfile.fullName} has requested to join ${company.name} as a Company Employer (Pending Approval).`,
            });
            for (const admin of companyAdmins) {
              const adminNotification = new Notification({
                ...notification.toObject(),
                userId: admin.userId,
              });
              await adminNotification.save();
              emitNotification(admin.userId.toString(), adminNotification);
            }
          } else {
            throw new Error("Invalid roleType for employer");
          }
          roleSpecificData = new RoleSpecificModel(employerData);
        } else {
          roleSpecificData = new RoleSpecificModel({ userId });
        }
        await roleSpecificData.save();
        await User.findByIdAndUpdate(userId, { roleSpecificData: roleSpecificData._id });
        logger.info(`Role-specific data created for userId: ${userId}, role: ${role}`);
      } else {
        const roleSpecificUpdates = {};
        Object.keys(updates).forEach((key) => {
          if (allowedUpdates.includes(key)) {
            roleSpecificUpdates[key] = updates[key];
          }
        });
        if (role === "employer" && updates.roleType) {
          if (updates.roleType === "Independent Recruiter") {
            roleSpecificUpdates.roleType = "Independent Recruiter";
            roleSpecificUpdates.status = "Active";
            roleSpecificUpdates.companyId = null;
            roleSpecificUpdates.companyName = null;
          } else if (updates.roleType === "Company Employer") {
            if (!updates.companyId) {
              throw new Error("companyId is required for Company Employer");
            }
            const company = await Company.findById(updates.companyId);
            if (!company) throw new Error("Company not found");
            roleSpecificUpdates.roleType = "Company Employer";
            roleSpecificUpdates.companyId = updates.companyId;
            roleSpecificUpdates.companyName = company.name;
            roleSpecificUpdates.status = "Pending";

            const companyAdmins = await CompanyAdmin.find({ companyId: updates.companyId, isDeleted: false }).select("userId");
            const notification = new Notification({
              userId: null,
              type: "employerApprovalRequest",
              relatedId: userProfile._id,
              message: `${userProfile.fullName} has requested to join ${company.name} as a Company Employer (Pending Approval).`,
            });
            for (const admin of companyAdmins) {
              const adminNotification = new Notification({
                ...notification.toObject(),
                userId: admin.userId,
              });
              await adminNotification.save();
              emitNotification(admin.userId.toString(), adminNotification);
            }
          } else {
            throw new Error("Invalid roleType for employer");
          }
        }
        if (Object.keys(roleSpecificUpdates).length > 0) {
          await RoleSpecificModel.findByIdAndUpdate(roleSpecificData._id, roleSpecificUpdates);
          logger.info(`Role-specific data updated for userId: ${userId}, role: ${role}`);
        }
      }
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      userId: userId,
    });
  } catch (error) {
    logger.error(`Error updating user profile: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while updating the user profile",
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only delete your own profile");
    const user = await checkUserExists(userId).lean();

    await User.findByIdAndUpdate(userId, { isDeleted: true });

    return res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting user account: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the user",
    });
  }
};