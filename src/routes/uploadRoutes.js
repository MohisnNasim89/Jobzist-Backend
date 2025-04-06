const express = require("express");
const upload = require("../config/multerConfig");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/profile-pic", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Validate file type (images only)
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Allowed types: image/jpeg, image/png" });
    }

    const userId = req.user.userId;
    const user = await require("../models/user/Users").findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update UserProfile with the profile picture URL
    const UserProfile = require("../models/user/UserProfile");
    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    userProfile.profilePicture = req.file.path;
    await userProfile.save();

    // If the user is a company admin and a companyId is provided, update the company logo
    if (user.role === "company_admin" && req.body.companyId) {
      const Company = require("../models/company/Company");
      const CompanyAdmin = require("../models/company/CompanyAdmin");

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

    res.status(200).json({
      message: "Profile picture uploaded and saved successfully",
      url: req.file.path,
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Upload resume (PDF only)
router.post("/resume", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Validate file type (PDF only)
    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Invalid file type. Allowed type: application/pdf" });
    }

    const userId = req.user.userId;
    const user = await require("../models/user/Users").findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "job_seeker") {
      return res.status(403).json({ message: "Only job seekers can upload a resume" });
    }

    const JobSeeker = require("../models/user/JobSeeker");
    const jobSeeker = await JobSeeker.findOne({ userId });
    if (!jobSeeker) {
      return res.status(404).json({ message: "Job seeker profile not found" });
    }

    jobSeeker.resume = req.file.path;
    await jobSeeker.save();

    res.status(200).json({
      message: "Resume uploaded and saved successfully",
      url: req.file.path,
    });
  } catch (error) {
    console.error("Error uploading resume:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;