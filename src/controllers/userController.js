// src/controllers/userController.js
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const renderProfile = require("../utils/renderProfile");

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.mongoId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only access your own profile" });
    }

    const user = await User.findById(userId)
      .populate("profileId")
      .populate("roleSpecificData");
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(user, "user");
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(200).json({
      profile: profileData,
    });
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.mongoId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only update your own profile" });
    }

    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = req.body;
    const role = user.role;

    // Update User model fields
    const allowedUserUpdates = ["fullName"];
    allowedUserUpdates.forEach((field) => {
      if (updates[field]) {
        user[field] = updates[field];
      }
    });
    await user.save();

    // Update UserProfile (applies to all users)
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

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

    // Update role-specific data (JobSeeker, Employer, or CompanyAdmin)
    const roleSpecificModels = {
      job_seeker: {
        model: require("../models/user/JobSeeker"),
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
        model: require("../models/user/Employer"),
        allowedUpdates: [
          "roleType",
          "companyId",
          "companyName",
          "status",
        ],
      },
      company_admin: {
        model: require("../models/user/CompanyAdmin"),
        allowedUpdates: ["companyId", "permissions", "status"],
      },
    };

    // Check if the user's role has a corresponding role-specific model
    if (roleSpecificModels[role]) {
      const { model: RoleSpecificModel, allowedUpdates } = roleSpecificModels[role];
      let roleSpecificData = await RoleSpecificModel.findOne({ userId });
      if (!roleSpecificData) {
        // Create a new role-specific profile if it doesn't exist
        roleSpecificData = new RoleSpecificModel({ userId });
      }

      // Update allowed fields in the role-specific model
      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          roleSpecificData[key] = updates[key];
        }
      });

      await roleSpecificData.save();
    }

    // Fetch the updated user with populated data
    const updatedUser = await User.findById(userId)
      .populate("profileId")
      .populate("roleSpecificData");
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(updatedUser, "user");
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.mongoId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only delete your own profile" });
    }

    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.softDelete();
    return res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};