const User = require("../models/users/Users");
const JobSeeker = require("../models/users/JobSeeker");
const Employer = require("../models/users/Employer");

/** @desc Get User Profile */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // Extracted from JWT middleware

    // Get user details
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let profile;
    if (user.role === "job_seeker") {
      profile = await JobSeeker.findOne({ userId }).populate("appliedJobs savedJobs");
    } else if (user.role === "employer") {
      profile = await Employer.findOne({ userId }).populate("jobListings hiredCandidates");
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    return res.status(200).json({ user, profile });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Update User Profile */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = req.body;

    let profile;
    if (req.user.role === "job_seeker") {
      profile = await JobSeeker.findOneAndUpdate({ userId }, updates, { new: true });
    } else if (req.user.role === "employer") {
      profile = await Employer.findOneAndUpdate({ userId }, updates, { new: true });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    return res.status(200).json({ message: "Profile updated", profile });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Delete User Profile */
exports.deleteProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Delete profile & user account
    await User.findByIdAndDelete(userId);
    if (req.user.role === "job_seeker") await JobSeeker.findOneAndDelete({ userId });
    if (req.user.role === "employer") await Employer.findOneAndDelete({ userId });

    return res.status(200).json({ message: "Profile deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
