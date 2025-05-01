const admin = require("../config/database/firebase");
const jwt = require("jsonwebtoken");
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const SuperAdmin = require("../models/user/SuperAdmin");
const { renderProfileWithFallback } = require("../utils/checks");
require("dotenv").config();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.register = async (req, res) => {
  const { email, password, role, fullName } = req.body;
  if (!email || !password || !role || !fullName) {
    throw new Error("All fields are required", { status: 400 });
  }

  const validRoles = ["job_seeker", "employer", "company_admin", "super_admin"];
  if (!validRoles.includes(role)) {
    throw new Error("Invalid role", { status: 400 });
  }

  const userRecord = await admin.auth().createUser({ email, password });
  if (!userRecord) {
    throw new Error("User creation failed", { status: 500 });
  }

  const newUser = new User({ authId: userRecord.uid, email, role });
  await newUser.save();

  const userProfile = new UserProfile({ userId: newUser._id, fullName });
  await userProfile.save();

  newUser.profileId = userProfile._id;
  await newUser.save();

  let roleSpecificData;
  switch (role) {
    case "job_seeker":
      roleSpecificData = new JobSeeker({ userId: newUser._id });
      break;
    case "employer":
      roleSpecificData = new Employer({ userId: newUser._id });
      break;
    case "company_admin":
      roleSpecificData = new CompanyAdmin({ userId: newUser._id });
      break;
    case "super_admin":
      roleSpecificData = new SuperAdmin({ userId: newUser._id });
      break;
    default:
      throw new Error("Invalid role");
  }
  await roleSpecificData.save();

  const emailVerificationLink = await admin.auth().generateEmailVerificationLink(email);

  return res.status(200).json({
    message: "Verification email sent",
    link: emailVerificationLink,
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new Error("Email and password are required", { status: 400 });
  }

  const userRecord = await admin.auth().getUserByEmail(email);
  if (!userRecord) {
    throw new Error("User not found in Firebase", { status: 404 });
  }
  
  const user = await User.findOne({ email, isDeleted: false })
    .populate({ path: "profileId", match: { isDeleted: false } })
    .populate({ path: "roleSpecificData", match: { isDeleted: false } });

  if (!user) {
    throw new Error("User not found", { status: 404 });
  }

  const token = generateToken(user._id.toString(), user.role);
  const profileData = renderProfileWithFallback(user, "user", {
    authId: user.authId,
    email: user.email,
    role: user.role,
    profile: user.profileId || {},
    roleSpecificData: user.roleSpecificData || {},
  });

  return res.status(200).json({
    message: "Login successful",
    token,
    profile: profileData,
  });
};

exports.oauthLogin = async (req, res) => {
  const { idToken, provider } = req.body;
  if (!idToken || !provider) {
    throw new Error("Invalid request", { status: 400 });
  }

  const decodedToken = await admin.auth().verifyIdToken(idToken);

  let user = await User.findOne({ authId: decodedToken.uid, isDeleted: false });
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    user = new User({
      authId: decodedToken.uid,
      email: decodedToken.email,
      role: "job_seeker",
    });
    await user.save();

    const userProfile = new UserProfile({
      userId: user._id,
      fullName: decodedToken.name || "Unknown",
    });
    await userProfile.save();

    user.profileId = userProfile._id;
    await user.save();

    const roleSpecificData = new JobSeeker({
      userId: user._id,
    });
    await roleSpecificData.save();
  }

  user = await User.findOne({ authId: decodedToken.uid, isDeleted: false })
    .populate({ path: "profileId", match: { isDeleted: false } })
    .populate({ path: "roleSpecificData", match: { isDeleted: false } });

  const token = generateToken(user._id.toString(), user.role);
  const profileData = renderProfileWithFallback(user, "user", {
    authId: user.authId,
    email: user.email,
    role: user.role,
    profile: user.profileId || {},
    roleSpecificData: user.roleSpecificData || {},
  });

  return res.status(200).json({
    message: isNewUser ? "User registered via OAuth" : "OAuth login successful",
    token,
    profile: profileData,
  });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) throw new Error("Email is required", { status: 400 });

  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    throw new Error("User not found", { status: 404 });
  }

  const resetLink = await admin.auth().generatePasswordResetLink(email);
  return res.status(200).json({ message: "Password reset link sent", resetLink });
};

exports.logout = async (req, res) => {
  return res.status(200).json({ message: "Logout successful" });
};