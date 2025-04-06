const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const renderProfile = require("../utils/renderProfile");

exports.updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;

    // Update UserProfile (applies to all users)
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    // Update allowed fields in UserProfile
    const allowedProfileUpdates = ["fullName", "bio", "location", "phoneNumber", "socialLinks", "profilePicture"];
    Object.keys(updates).forEach((key) => {
      if (allowedProfileUpdates.includes(key)) {
        userProfile[key] = updates[key];
      }
    });

    await userProfile.save();

    // Update JobSeeker (only for job seekers)
    if (req.user.role === "job_seeker" && updates.resume) {
      const JobSeeker = require("../models/user/JobSeeker");
      const jobSeeker = await JobSeeker.findOne({ userId });
      if (!jobSeeker) {
        return res.status(404).json({ message: "Job seeker profile not found" });
      }

      jobSeeker.resume = updates.resume;
      await jobSeeker.save();
    }

    // Fetch the updated user with populated data
    const user = await User.findById(userId)
      .populate("profileId")
      .populate("roleSpecificData");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(user, "user");
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
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.softDelete();
    return res.status(200).json({ message: "User account soft deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};