const User = require("../models/user/Users");
const Job = require("../models/job/Job");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const SuperAdmin = require("../models/user/SuperAdmin");
const Company = require("../models/company/Company");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const Post = require("../models/post/Posts");
const renderProfile = require("./renderProfile");

const checkRole = (role, allowedRoles, message) => {
  if (!allowedRoles.includes(role)) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
};

const checkUserExists = async (userId, message = "User not found") => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return user;
};

const checkUserIdMatch = (paramUserId, reqUserId, message = "Unauthorized: User ID does not match") => {
  if (paramUserId.toString() !== reqUserId.toString()) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
};

const checkUserProfileExists = async (userId, message = "User profile not found") => {
  const userProfile = await UserProfile.findOne({ userId: userId, isDeleted: false });
  if (!userProfile) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return userProfile;
};

const checkCompanyExists = async (companyId, message = "Company not found") => {
  const company = await Company.findOne({ _id: companyId, isDeleted: false });
  if (!company) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return company;
};

const checkCompanyAdminExists = async (userId, message = "Company admin profile not found") => {
  const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
  if (!companyAdmin) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return companyAdmin;
};

const checkJobExists = async (jobId, message = "Job not found") => {
  const job = await Job.findOne({ _id: jobId, isDeleted: false });
  if (!job) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return job;
};

const renderProfileWithFallback = (entity, type, fallback) => {
  try {
    return renderProfile(entity, type);
  } catch (error) {
    console.error(`Error rendering ${type} profile:`, error);
    return fallback;
  }
};

// New utility functions for Posts module
const checkPostExists = async (postId, message = "Post not found") => {
  const post = await Post.findOne({ _id: postId, isDeleted: false })
    .populate("userId", "email role")
    .populate("tags.id", "name");
  if (!post) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return post;
};

const checkPostOwnership = (post, userId, message = "Unauthorized: You are not the owner of this post") => {
  if (post.userId._id.toString() !== userId.toString()) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
};

const checkUserOrCompanyExists = async (type, id, message = "Tagged entity not found") => {
  const Model = type === "User" ? User : Company;
  const entity = await Model.findOne({ _id: id, isDeleted: false });
  if (!entity) {
    const error = new Error(message);
    error.status = 404;
    throw error;
  }
  return entity;
};

module.exports = {
  checkRole,
  checkUserExists,
  checkUserIdMatch,
  checkUserProfileExists,
  checkCompanyExists,
  checkCompanyAdminExists,
  checkJobExists,
  renderProfileWithFallback,
  checkPostExists,
  checkPostOwnership,
  checkUserOrCompanyExists,
};