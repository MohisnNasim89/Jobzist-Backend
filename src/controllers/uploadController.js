const Company = require("../models/company/Company");
const {
  checkUserExists,
  checkUserIdMatch,
  checkUserProfileExists,
  checkRole,
  checkCompanyAdminExists,
} = require("../utils/checks");

exports.uploadProfilePic = async (req, res) => {
  const userId = req.params.userId;
  const authenticatedUserId = req.user.userId;

  checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only upload a profile picture for yourself");

  if (!req.file || !req.file.path) {
    throw new Error("No file uploaded or upload failed", { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png"];
  if (!allowedTypes.includes(req.file.mimetype)) {
    throw new Error("Invalid file type. Allowed types: image/jpeg, image/png", { status: 400 });
  }

  const user = await checkUserExists(userId);
  const userProfile = await checkUserProfileExists(userId);

  userProfile.profilePicture = req.file.path;
  await userProfile.save();

  if (user.role === "company_admin" && req.body.companyId) {
    const company = await Company.findOne({ _id: req.body.companyId, isDeleted: false });
    if (!company) {
      throw new Error("Company not found", { status: 404 });
    }

    const companyAdmin = await checkCompanyAdminExists(userId);
    if (companyAdmin.companyId.toString() !== req.body.companyId.toString()) {
      throw new Error("Unauthorized: You are not an admin of this company", { status: 403 });
    }

    company.logo = req.file.path;
    await company.save();
  }

  return res.status(200).json({
    message: "Profile picture uploaded and saved successfully",
    url: req.file.path,
  });
};

exports.uploadResume = async (req, res) => {
  const userId = req.params.userId;
  const authenticatedUserId = req.user.userId;

  checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only upload a resume for yourself");

  if (!req.file || !req.file.path) {
    throw new Error("No file uploaded or upload failed", { status: 400 });
  }

  const allowedTypes = ["application/pdf"];
  if (!allowedTypes.includes(req.file.mimetype)) {
    throw new Error("Invalid file type. Allowed type: application/pdf", { status: 400 });
  }

  const user = await checkUserExists(userId);
  checkRole(user.role, ["job_seeker"], "Only job seekers can upload a resume");

  const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false });
  if (!jobSeeker) {
    throw new Error("Job seeker profile not found", { status: 404 });
  }

  jobSeeker.resume = req.file.path;
  await jobSeeker.save();

  return res.status(200).json({
    message: "Resume uploaded and saved successfully",
    url: req.file.path,
  });
};