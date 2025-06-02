const Company = require("../models/company/Company");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const User = require("../models/user/Users");
const fs = require("fs").promises;
const logger = require("../utils/logger");
const {
  checkUserExists,
  checkUserIdMatch,
  checkUserProfileExists,
  checkRole,
  checkCompanyAdminExists,
} = require("../utils/checks");
const cloudinary = require("../config/cloudinaryConfig");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

exports.uploadProfilePic = async (req, res) => {
  try {
    const id = req.params.userId; 
    const authenticatedUserId = req.user.userId;

    // Set upload type for profile picture
    req.uploadType = "profilePicture";

    logger.info(`Uploading file for id: ${id}`);

    if (!req.file || !req.file.path) {
      const error = new Error("No file uploaded or upload failed");
      error.status = 400;
      throw error;
    }

    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      const error = new Error("Invalid file type. Allowed types: image/jpeg, image/png");
      error.status = 400;
      throw error;
    }

    if (req.file.size > MAX_FILE_SIZE) {
      const error = new Error("File size exceeds 5MB limit");
      error.status = 400;
      throw error;
    }

    const user = await User.findById(id).exec();
    const company = await Company.findById(id).exec();

    if (user) {
      logger.info(`Id ${id} identified as userId`);
      checkUserIdMatch(id, authenticatedUserId, "Unauthorized: You can only upload a profile picture for yourself");

      const userProfile = await checkUserProfileExists(id);
      if (!userProfile) {
        const error = new Error("User profile not found");
        error.status = 404;
        throw error;
      }

      logger.info(`Updating profile picture for userId: ${id}`);
      userProfile.profilePicture = req.file.path;
      await userProfile.save();
      logger.info(`Profile picture updated for userId: ${id}`);

      res.status(200).json({
        message: "Profile picture uploaded successfully",
        url: req.file.path,
      });
    } else if (company) {
      logger.info(`Id ${id} identified as companyId`);

      const authenticatedUser = await checkUserExists(authenticatedUserId);
      checkRole(authenticatedUser.role, ["company_admin"], "Only company admins can upload a company logo");

      const companyAdmin = await checkCompanyAdminExists(authenticatedUserId);
      if (!companyAdmin) {
        const error = new Error("Company admin profile not found");
        error.status = 404;
        throw error;
      }

      if (companyAdmin.companyId.toString() !== id.toString()) {
        const error = new Error("Unauthorized: You are not an admin of this company");
        error.status = 403;
        throw error;
      }

      logger.info(`Updating company logo for companyId: ${id}`);
      company.logo = req.file.path;
      await company.save();
      logger.info(`Company logo updated for companyId: ${id}`);

      res.status(200).json({
        message: "Company logo uploaded successfully",
        url: req.file.path,
      });
    } else {
      const error = new Error("Invalid ID: No matching user or company found");
      error.status = 404;
      throw error;
    }
  } catch (error) {
    logger.error(`Error uploading file: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while uploading the file",
    });
  }
};

exports.uploadResume = async (req, res) => {
  try {
    const userId = req.params.userId;
    const authenticatedUserId = req.user.userId;

    // Set upload type for resume
    req.uploadType = "resume";

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only upload a resume for yourself");

    if (!req.file || !req.file.path) {
      throw new Error("No file uploaded or upload failed");
    }

    const allowedTypes = ["application/pdf"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw new Error("Invalid file type. Allowed type: application/pdf");
    }

    if (req.file.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 5MB limit");
    }

    const user = await checkUserExists(userId);
    checkRole(user.role, ["job_seeker"], "Only job seekers can upload a resume");

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false });
    if (!jobSeeker) {
      throw new Error("Job seeker profile not found");
    }

    if (jobSeeker.resume) {
      try {
        const publicId = extractPublicIdFromUrl(jobSeeker.resume);
        await cloudinary.uploader.destroy(publicId);
        logger.info(`Old resume with public_id ${publicId} deleted from Cloudinary for user ${userId}`);
      } catch (cleanupError) {
        logger.warn(`Failed to delete old resume from Cloudinary: ${cleanupError.message}`);
      }
    }

    jobSeeker.resume = req.file.path;
    await jobSeeker.save();

    res.status(200).json({
      message: "Resume uploaded and saved successfully",
      url: req.file.path,
    });
  } catch (error) {
    logger.error(`Error uploading resume: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while uploading the resume",
    });
  }
};

function extractPublicIdFromUrl(url) {
  const urlParts = url.split("/");
  const filePart = urlParts.pop();
  const publicId = filePart.split("/").pop().split(".")[0]; 
  return publicId;
}