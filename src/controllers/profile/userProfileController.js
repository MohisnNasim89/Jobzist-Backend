const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const { checkUserExists, checkUserIdMatch, checkUserProfileExists, renderProfileWithFallback } = require("../../utils/checks");

exports.createUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only create a profile for yourself");
    const user = await checkUserExists(userId);

    let userProfile = await UserProfile.findOne({ userId, isDeleted: false });
    if (userProfile) {
      throw new Error("User profile already exists. Use the update endpoint to modify it.");
    }

    const { fullName } = req.body;
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

    user.profileId = userProfile._id;
    await user.save();

    const roleSpecificModels = {
      job_seeker: JobSeeker,
      employer: Employer,
      company_admin: CompanyAdmin,
    };

    if (roleSpecificModels[user.role]) {
      const RoleSpecificModel = roleSpecificModels[user.role];
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false });
      if (!roleSpecificData) {
        roleSpecificData = new RoleSpecificModel({ userId });
        await roleSpecificData.save();
        user.roleSpecificData = roleSpecificData._id;
        await user.save();
      }
    }

    const updatedUser = await User.findOne({ _id: userId, isDeleted: false })
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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while creating the user profile",
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only access your own profile");

    const user = await User.findOne({ _id: userId, isDeleted: false })
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });

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
    Object.keys(updates).forEach((key) => {
      if (allowedProfileUpdates.includes(key)) {
        userProfile[key] = updates[key];
      }
    });
    await userProfile.save();

    const roleSpecificModels = {
      job_seeker: {
        model: JobSeeker,
        allowedUpdates: [
          "resume",
          "skills",
          "education",
          "experience",
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
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false });
      if (!roleSpecificData) {
        roleSpecificData = new RoleSpecificModel({ userId });
      }

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          roleSpecificData[key] = updates[key];
        }
      });

      await roleSpecificData.save();
    }

    const updatedUser = await User.findOne({ _id: userId, isDeleted: false })
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
    const user = await checkUserExists(userId);

    await user.softDelete();
    return res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the user",
    });
  }
};