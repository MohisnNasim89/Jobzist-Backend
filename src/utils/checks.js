const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const Company = require("../models/company/Company");
const Job = require("../models/job/Job");
const Post = require("../models/post/Posts");

const checkUserExists = async (userId) => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }
  return user;
};

const checkUserIdMatch = (userId, authenticatedUserId, message) => {
  if (userId.toString() !== authenticatedUserId.toString()) {
    const error = new Error(message || "Unauthorized");
    error.status = 403;
    throw error;
  }
};

const checkUserProfileExists = async (userId) => {
  const userProfile = await UserProfile.findOne({ userId, isDeleted: false });
  if (!userProfile) {
    const error = new Error("User profile not found");
    error.status = 404;
    throw error;
  }
  return userProfile;
};

const checkRole = (role, allowedRoles, message) => {
  if (!allowedRoles.includes(role)) {
    const error = new Error(message || "Unauthorized: Invalid role");
    error.status = 403;
    throw error;
  }
};

const checkJobExists = (jobId) => {
  return Job.findOne({ _id: jobId, isDeleted: false });
};

const checkCompanyExists = async (companyId) => {
  const company = await Company.findOne({ _id: companyId, isDeleted: false });
  if (!company) {
    const error = new Error("Company not found");
    error.status = 404;
    throw error;
  }
  return company;
};

const checkEmployerExists = async (userId) => {
  const employer = await Employer.findOne({ userId, isDeleted: false });
  if (!employer) {
    const error = new Error("Employer not found");
    error.status = 404;
    throw error;
  }
  return employer;
};

const checkCompanyAdminExists = async (userId) => {
  const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
  if (!companyAdmin) {
    const error = new Error("Company admin not found");
    error.status = 404;
    throw error;
  }
  return companyAdmin;
};

const checkJobSeekerExists = async (userId) => {
  const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false });
  if (!jobSeeker) {
    const error = new Error("Job seeker not found");
    error.status = 404;
    throw error;
  }
  return jobSeeker;
};

const checkPostExists = async (postId) => {
  const post = await Post.findOne({ _id: postId, isDeleted: false });
  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }
  return post;
};

const checkPostOwnership = (post, userId) => {
  if (post.userId.toString() !== userId.toString()) {
    const error = new Error("Unauthorized: You do not own this post");
    error.status = 403;
    throw error;
  }
};

const checkUserOrCompanyExists = async (type, id) => {
  let model;
  if (type === "user") {
    model = User;
  } else if (type === "company") {
    model = Company;
  } else {
    const error = new Error("Invalid type specified");
    error.status = 400;
    throw error;
  }
  const entity = await model.findOne({ _id: id, isDeleted: false });
  if (!entity) {
    const error = new Error(`${type} not found`);
    error.status = 404;
    throw error;
  }
  return entity;
};

const renderProfileWithFallback = (entity, type, fallback, isCreator = false) => {
  const profile = {};
  if (!entity) return fallback;

  switch (type) {
    case "user":
      profile.authId = entity.authId || fallback.authId;
      profile.email = entity.email || fallback.email;
      profile.role = entity.role || fallback.role;
      profile.profile = entity.profileId || fallback.profile || {};
      profile.roleSpecificData = entity.roleSpecificData || fallback.roleSpecificData || {};
      break;
    case "job":
      profile._id = entity._id || fallback._id;
      profile.title = entity.title || fallback.title;
      profile.companyId = entity.companyId || fallback.companyId;
      profile.company = entity.companyId
        ? {
            _id: entity.companyId._id || (fallback.company ? fallback.company._id : null),
            name: entity.companyId.name || (fallback.company ? fallback.company.name : null),
            logo: entity.companyId.logo || (fallback.company ? fallback.company.logo : null),
          }
        : fallback.company || null;
      profile.postedBy = entity.postedBy?.profileId?.fullName || fallback.postedBy || "Unknown";
      profile.description = entity.description || fallback.description;
      profile.location = entity.location || fallback.location;
      profile.jobType = entity.jobType || fallback.jobType;
      profile.salary = entity.salary || fallback.salary;
      profile.requirements = entity.requirements || fallback.requirements;
      profile.skills = entity.skills || fallback.skills;
      profile.experienceLevel = entity.experienceLevel || fallback.experienceLevel;
      profile.applicationDeadline = entity.applicationDeadline || fallback.applicationDeadline;
      profile.status = entity.status || fallback.status;
      profile.createdAt = entity.createdAt || fallback.createdAt;

      if (isCreator) {
        profile.applicants = entity.applicants || [];
        profile.savedBy = entity.savedBy || [];
        profile.hiredCandidates = entity.hiredCandidates || [];
      }
      break;
    case "company":
      profile.name = entity.name || fallback.name || "Unnamed Company";
      profile.industry = entity.industry || fallback.industry || "Unknown Industry";
      profile.location = entity.location || fallback.location || { country: "Unknown", city: "Unknown", address: "Unknown" };
      profile.website = entity.website || fallback.website || "Not provided";
      profile.websiteDomain = entity.website ? new URL(entity.website).hostname : fallback.websiteDomain || "Not provided";
      profile.description = entity.description || fallback.description || "No description available";
      profile.descriptionSummary = entity.description
        ? entity.description.split(" ").slice(0, 10).join(" ") || fallback.descriptionSummary || "No description"
        : fallback.descriptionSummary || "No description";
      profile.companySize = entity.companySize || fallback.companySize || "Unknown";
      profile.foundedYear = entity.foundedYear || fallback.foundedYear || "Unknown";
      profile.socialLinks = entity.socialLinks || fallback.socialLinks || [];
      profile.logo = entity.logo || fallback.logo || "Not provided";
      profile.jobListings = entity.jobListings || fallback.jobListings || [];
      break;
    default:
      return fallback;
  }
  return profile;
};

module.exports = {
  checkUserExists,
  checkUserIdMatch,
  checkUserProfileExists,
  checkRole,
  checkJobExists,
  checkCompanyExists,
  checkEmployerExists,
  checkCompanyAdminExists,
  checkJobSeekerExists,
  checkPostExists,
  checkPostOwnership,
  checkUserOrCompanyExists,
  renderProfileWithFallback,
};