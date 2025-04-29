const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const JobSeeker = require("../../models/user/JobSeeker");
const Employer = require("../../models/user/Employer");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const renderProfile = require("../../utils/renderProfile");

exports.createUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only create a profile for yourself" });
    }

    // Check if the user exists and is not soft-deleted
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if a UserProfile already exists
    let userProfile = await UserProfile.findOne({ userId, isDeleted: false });
    if (userProfile) {
      return res.status(400).json({ message: "User profile already exists. Use the update endpoint to modify it." });
    }

    // Validate required fields
    const { fullName } = req.body;
    if (!fullName) {
      return res.status(400).json({ message: "Full name is required to create a user profile" });
    }

    // Create a new UserProfile
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

    // Link the UserProfile to the User
    user.profileId = userProfile._id;
    await user.save();

    // Create role-specific data if it doesn't exist
    const role = user.role;
    const roleSpecificModels = {
      job_seeker: JobSeeker,
      employer: Employer,
      company_admin: CompanyAdmin,
    };

    if (roleSpecificModels[role]) {
      const RoleSpecificModel = roleSpecificModels[role];
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false });
      if (!roleSpecificData) {
        roleSpecificData = new RoleSpecificModel({ userId });
        await roleSpecificData.save();
        user.roleSpecificData = roleSpecificData._id;
        await user.save();
      }
    }

    // Fetch the updated user with populated data
    const updatedUser = await User.findOne({ _id: userId, isDeleted: false })
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found after profile creation" });
    }

    // Render the profile
    let profileData;
    try {
      profileData = renderProfile(updatedUser, "user");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
        authId: updatedUser.authId,
        email: updatedUser.email,
        role: updatedUser.role,
        profile: updatedUser.profileId || {},
        roleSpecificData: updatedUser.roleSpecificData || {},
      };
    }

    return res.status(201).json({
      message: "User profile created successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("Error in createUserProfile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only access your own profile" });
    }

    const user = await User.findOne({ _id: userId, isDeleted: false })
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(user, "user");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
        authId: user.authId,
        email: user.email,
        role: user.role,
        profile: user.profileId || {},
        roleSpecificData: user.roleSpecificData || {},
      };
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
    const authenticatedUserId = req.user.userId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only update your own profile" });
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = req.body;
    const role = user.role;

    // Update UserProfile (applies to all users)
    const userProfile = await UserProfile.findOne({ userId, isDeleted: false });
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

    // Check if the user's role has a corresponding role-specific model
    if (roleSpecificModels[role]) {
      const { model: RoleSpecificModel, allowedUpdates } = roleSpecificModels[role];
      let roleSpecificData = await RoleSpecificModel.findOne({ userId, isDeleted: false });
      if (!roleSpecificData) {
        // Create a new role-specific profile if it doesn't exist
        roleSpecificData = new RoleSpecificModel({ userId });
      }

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          roleSpecificData[key] = updates[key];
        }
      });

      await roleSpecificData.save();
    }

    // Fetch the updated user with populated data
    const updatedUser = await User.findOne({ _id: userId, isDeleted: false })
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(updatedUser, "user");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
        authId: updatedUser.authId,
        email: updatedUser.email,
        role: updatedUser.role,
        profile: updatedUser.profileId || {},
        roleSpecificData: updatedUser.roleSpecificData || {},
      };
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
    const authenticatedUserId = req.user.userId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only delete your own profile" });
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.softDelete();
    return res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};