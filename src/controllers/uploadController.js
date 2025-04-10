// src/controllers/uploadController.js
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Company = require("../models/company/Company");
const CompanyAdmin = require("../models/user/CompanyAdmin");

exports.uploadProfilePic = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.mongoId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only upload a profile picture for yourself" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Validate file type (images only)
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Allowed types: image/jpeg, image/png" });
    }

    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update UserProfile with the profile picture URL
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    userProfile.profilePicture = req.file.path;
    await userProfile.save();

    // If the user is a company admin and a companyId is provided, update the company logo
    if (user.role === "company_admin" && req.body.companyId) {
      const company = await Company.findById(req.body.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const companyAdmin = await CompanyAdmin.findOne({ userId });
      if (!companyAdmin || companyAdmin.companyId.toString() !== req.body.companyId.toString()) {
        return res.status(403).json({ message: "Unauthorized: You are not an admin of this company" });
      }

      company.profile.logo = req.file.path;
      await company.save();
    }

    return res.status(200).json({
      message: "Profile picture uploaded and saved successfully",
      url: req.file.path,
    });
  } catch (error) {
    console.error("Error in uploadProfilePic:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.uploadResume = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.mongoId;

    // Ensure the userId in the route matches the authenticated user
    if (userId !== authenticatedUserId) {
      return res.status(403).json({ message: "Unauthorized: You can only upload a resume for yourself" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Validate file type (PDF only)
    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Allowed type: application/pdf" });
    }

    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "job_seeker") {
      return res.status(403).json({ message: "Only job seekers can upload a resume" });
    }

    const jobSeeker = await JobSeeker.findOne({ userId });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    jobSeeker.resume = req.file.path;
    await jobSeeker.save();

    return res.status(200).json({
      message: "Resume uploaded and saved successfully",
      url: req.file.path,
    });
  } catch (error) {
    console.error("Error in uploadResume:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};