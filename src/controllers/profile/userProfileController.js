const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const Company = require("../../models/company/Company");
const logger = require("../../utils/logger");
const { checkUserExists, checkUserIdMatch, checkUserProfileExists, renderProfileWithFallback } = require("../../utils/checks");

exports.createUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only create a profile for yourself");
    const user = await checkUserExists(userId);

    let userProfile = await UserProfile.findOne({ userId, isDeleted: false })
      .select("userId isDeleted")
      .lean();
    if (userProfile) {
      throw new Error("User profile already exists. Use the update endpoint to modify it.");
    }

    const { fullName, roleType, companyId } = req.body;
    if (!fullName) {
      throw new Error("Full name is required to create a user profile");
    }

    userProfile = new UserProfile({
      userId,
      fullName,
      bio: req.body.bio || "",
      location: req.body.location || { country: "", city: "", address: "" },
      phoneNumber: req.body.phoneNumber || "",
      socialLinks: req.body.socialLinks || [],
      profilePicture: req.body.profilePicture || "",
    });
    await userProfile.save();

    await User.findByIdAndUpdate(userId, { profileId: userProfile._id });

    const roleSpecificModels = {
      job_seeker: JobSeeker,
      employer: Employer,
      company_admin: CompanyAdmin,
    };

    if (roleSpecificModels[user.role]) {
      const RoleSpecificModel = roleSpecificModels[user.role];
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false })
        .select("userId isDeleted")
        .lean();
      if (!roleSpecificData) {
        if (user.role === "employer") {
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
            employerData.status = "Pending"; // Requires admin approval
          } else {
            throw new Error("Invalid roleType for employer");
          }
          roleSpecificData = new RoleSpecificModel(employerData);
        } else {
          roleSpecificData = new RoleSpecificModel({ userId });
        }
        await roleSpecificData.save();
        await User.findByIdAndUpdate(userId, { roleSpecificData: roleSpecificData._id });
      }
    }

    const updatedUser = await User.findOne({ _id: userId, isDeleted: false })
      .select("authId email role profileId roleSpecificData")
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });

    if (!updatedUser) {
      throw new Error("User not found after profile creation");
    }

    const profileData = renderProfileWithFallback(updatedUser, "user", {
      authId: updatedUser.authId,
      email: updatedUser.email,
      role: updatedUser.role,
      profile: updatedUser.profileId || {},
      roleSpecificData: updatedUser.roleSpecificData || {},
    });

    return res.status(201).json({
      message: "User profile created successfully",
      profile: profileData,
    });
  } catch (error) {
    logger.error(`Error creating user profile: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while creating the user profile",
    });
  }
};

// Remaining functions (getCurrentUser, updateUserProfile, deleteUser) remain unchanged as provided
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

    const updates = req.body;
    const role = user.role;

    const userProfile = await checkUserProfileExists(userId);

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
    await UserProfile.findByIdAndUpdate(userProfile._id, profileUpdates);

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
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false })
        .select("_id")
        .lean();
      if (!roleSpecificData) {
        roleSpecificData = new RoleSpecificModel({ userId });
      }

      const roleSpecificUpdates = {};
      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          roleSpecificUpdates[key] = updates[key];
        }
      });

      await RoleSpecificModel.findByIdAndUpdate(roleSpecificData._id || roleSpecificData, roleSpecificUpdates);
    }

    const updatedUser = await User.findOne({ _id: userId, isDeleted: false })
      .select("authId email role profileId roleSpecificData")
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });

    if (!updatedUser) {
      throw new Error("User not found");
    }

    const profileData = renderProfileWithFallback(updatedUser, "user", {
      authId: updatedUser.authId,
      email: updatedUser.email,
      role: updatedUser.role,
      profile: updatedUser.profileId || {},
      roleSpecificData: updatedUser.roleSpecificData || {},
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: profileData,
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