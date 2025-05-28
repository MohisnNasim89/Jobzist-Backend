const mongoose = require("mongoose");
const NodeCache = require("node-cache");
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const Company = require("../models/company/Company");
const Job = require("../models/job/Job");
const Post = require("../models/post/Posts");
const logger = require("./logger");

const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

const sanitizeId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid ID format");
    error.status = 400;
    throw error;
  }
  return id;
};

const checkUserExists = async (userId) => {
  const sanitizedId = sanitizeId(userId);
  const cacheKey = `user_${sanitizedId}`;
  const cachedUser = cache.get(cacheKey);
  if (cachedUser) return cachedUser;

  const user = await User.findOne({ _id: sanitizedId, isDeleted: false }).lean();
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }
  cache.set(cacheKey, user);
  return user;
};

const checkUserIdMatch = (userId, authenticatedUserId, message) => {
  const sanitizedUserId = sanitizeId(userId);
  const sanitizedAuthUserId = sanitizeId(authenticatedUserId);
  if (sanitizedUserId.toString() !== sanitizedAuthUserId.toString()) {
    const error = new Error(message || "Unauthorized");
    error.status = 403;
    throw error;
  }
};

const checkUserProfileExists = async (userId) => {
  const sanitizedId = sanitizeId(userId);
  const cacheKey = `profile_${sanitizedId}`;
  const cachedProfile = cache.get(cacheKey);
  if (cachedProfile) return cachedProfile;

  const userProfile = await UserProfile.findOne({ userId: sanitizedId, isDeleted: false }).lean();
  if (!userProfile) {
    const error = new Error("User profile not found");
    error.status = 404;
    throw error;
  }
  cache.set(cacheKey, userProfile);
  return userProfile;
};

const checkRole = (role, allowedRoles, message) => {
  if (!allowedRoles.includes(role)) {
    const error = new Error(message || "Unauthorized: Invalid role");
    error.status = 403;
    throw error;
  }
};

const checkJobExists = async (jobId) => {
  const sanitizedId = sanitizeId(jobId);
  const job = await Job.findOne({ _id: sanitizedId, isDeleted: false }).lean();
  if (!job) {
    const error = new Error("Job not found");
    error.status = 404;
    throw error;
  }
  return job;
};

const checkCompanyExists = async (companyId) => {
  const sanitizedId = sanitizeId(companyId);
  const company = await Company.findOne({ _id: sanitizedId, isDeleted: false }).lean();
  if (!company) {
    const error = new Error("Company not found");
    error.status = 404;
    throw error;
  }
  return company;
};

const checkEmployerExists = async (userId) => {
  const sanitizedId = sanitizeId(userId);
  const employer = await Employer.findOne({ userId: sanitizedId, isDeleted: false }).lean();
  if (!employer) {
    const error = new Error("Employer not found");
    error.status = 404;
    throw error;
  }
  return employer;
};

const checkCompanyAdminExists = async (userId) => {
  const sanitizedId = sanitizeId(userId);
  const companyAdmin = await CompanyAdmin.findOne({ userId: sanitizedId, isDeleted: false }).lean();
  if (!companyAdmin) {
    const error = new Error("Company admin not found");
    error.status = 404;
    throw error;
  }
  return companyAdmin;
};

const checkJobSeekerExists = async (userId) => {
  const sanitizedId = sanitizeId(userId);
  const jobSeeker = await JobSeeker.findOne({ userId: sanitizedId, isDeleted: false }).lean();
  if (!jobSeeker) {
    const error = new Error("Job seeker not found");
    error.status = 404;
    throw error;
  }
  return jobSeeker;
};

const checkPostExists = async (postId) => {
  const sanitizedId = sanitizeId(postId);
  const post = await Post.findOne({ _id: sanitizedId, isDeleted: false }).lean();
  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }
  return post;
};

const checkPostOwnership = (post, userId) => {
  const sanitizedId = sanitizeId(userId);
  if (post.userId.toString() !== sanitizedId.toString()) {
    const error = new Error("Unauthorized: You do not own this post");
    error.status = 403;
    throw error;
  }
};

const checkUserOrCompanyExists = async (type, id) => {
  const sanitizedId = sanitizeId(id);
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
  const entity = await model.findOne({ _id: sanitizedId, isDeleted: false }).lean();
  if (!entity) {
    const error = new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} not found`);
    error.status = 404;
    throw error;
  }
  return entity;
};

const renderProfileWithFallback = (entity, type, fallback = {}, isCreator = false) => {
  if (!entity) return { ...fallback, type };

  const profile = { type };
  switch (type) {
    case "user":
      Object.assign(profile, {
        userId: entity._id || fallback.userId,
        authId: entity.authId || fallback.authId,
        email: entity.email || fallback.email,
        role: entity.role || fallback.role,
        profile: entity.profileId || fallback.profile || {},
        roleSpecificData: entity.roleSpecificData || fallback.roleSpecificData || {},
      });
      break;
    case "job":
      Object.assign(profile, {
        jobId: entity._id || fallback._id,
        title: entity.title || fallback.title || "Untitled Job",
        company: entity.companyId
          ? {
              companyId: entity.companyId._id || (fallback.company ? fallback.company._id : null),
              name: entity.companyId.name || (fallback.company ? fallback.company.name : "Unnamed Company"),
              logo: entity.companyId.logo || (fallback.company ? fallback.company.logo : null),
            }
          : fallback.company || null,
        postedBy: entity.postedBy?.profileId?.fullName || fallback.postedBy || "Unknown",
        description: entity.description || fallback.description || "No description",
        location: entity.location || fallback.location || { country: "Unknown", city: "Unknown" },
        jobType: entity.jobType || fallback.jobType || "Unknown",
        salary: entity.salary || fallback.salary || { min: 0, max: 0, currency: "Unknown" },
        requirements: entity.requirements || fallback.requirements || [],
        skills: entity.skills || fallback.skills || [],
        experienceLevel: entity.experienceLevel || fallback.experienceLevel || "Unknown",
        applicationDeadline: entity.applicationDeadline || fallback.applicationDeadline || null,
        status: entity.status || fallback.status || "Unknown",
        createdAt: entity.createdAt || fallback.createdAt,
        ...(isCreator && {
          applicants: entity.applicants || [],
          savedBy: entity.savedBy || [],
          hiredCandidates: entity.hiredCandidates || [],
        }),
      });
      break;
    case "company":
      Object.assign(profile, {
        companyId: entity._id || fallback._id,
        name: entity.name || fallback.name || "Unnamed Company",
        industry: entity.industry || fallback.industry || "Unknown Industry",
        location: entity.location || fallback.location || { country: "Unknown", city: "Unknown", address: "Unknown" },
        website: entity.website || fallback.website || "Not provided",
        websiteDomain: entity.website ? new URL(entity.website).hostname : (fallback.websiteDomain || "Not provided"),
        description: entity.description || fallback.description || "No description available",
        descriptionSummary: entity.description
          ? entity.description.split(" ").slice(0, 10).join(" ") + "..."
          : (fallback.descriptionSummary || "No description"),
        companySize: entity.companySize || fallback.companySize || "Unknown",
        foundedYear: entity.foundedYear || fallback.foundedYear || "Unknown",
        socialLinks: entity.socialLinks || fallback.socialLinks || [],
        logo: entity.logo || fallback.logo || "Not provided",
        jobListings: entity.jobListings || fallback.jobListings || [],
      });
      break;
    case "job_seeker":
      Object.assign(profile, {
        userId: entity.userId || fallback.userId || null,
        resume: entity.resume || fallback.resume || "Not provided",
        skills: entity.skills || fallback.skills || [],
        education: entity.education || fallback.education || [],
        experience: entity.experience || fallback.experience || [],
        jobPreferences: entity.jobPreferences || fallback.jobPreferences || {},
        appliedJobs: entity.appliedJobs || fallback.appliedJobs || [],
        savedJobs: entity.savedJobs || fallback.savedJobs || [],
        status: entity.status || fallback.status || "Unknown",
      });
      break;
    case "employer":
      Object.assign(profile, {
        userId: entity.userId || fallback.userId || null,
        roleType: entity.roleType || fallback.roleType || "Unknown",
        companyId: entity.companyId || fallback.companyId || null,
        companyName: entity.companyName || fallback.companyName || "Not associated",
        jobListings: entity.jobListings || fallback.jobListings || [],
        hiredCandidates: entity.hiredCandidates || fallback.hiredCandidates || [],
        status: entity.status || fallback.status || "Unknown",
      });
      break;
    default:
      return { ...fallback, type };
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