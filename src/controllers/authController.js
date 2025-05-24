const admin = require("../config/database/firebase");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const SuperAdmin = require("../models/user/SuperAdmin");
const { renderProfileWithFallback } = require("../utils/checks");
const logger = require("../utils/logger");
require("dotenv").config();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const getRoleModel = (role) => {
  switch (role) {
    case "job_seeker": return JobSeeker;
    case "employer": return Employer;
    case "company_admin": return CompanyAdmin;
    case "super_admin": return SuperAdmin;
    default: return null;
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, role, fullName } = req.body;
    if (!email || !password || !role || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const validRoles = ["job_seeker", "employer", "company_admin", "super_admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email }).lean(); // lean: not modifying user object
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userRecord = await admin.auth().createUser({ email, password });
    const newUser = new User({ authId: userRecord.uid, email, role, password: hashedPassword });
    await newUser.save();

    const userProfile = new UserProfile({ userId: newUser._id, fullName });
    await userProfile.save();

    newUser.profileId = userProfile._id;
    await newUser.save();

    const RoleModel = getRoleModel(role);
    const roleData = new RoleModel({ userId: newUser._id });
    await roleData.save();

    const emailVerificationLink = await admin.auth().generateEmailVerificationLink(email);

    res.status(200).json({
      message: "Verification email sent",
      link: emailVerificationLink,
    });
  } catch (error) {
    logger.error(`Registration Error: ${error.message}`);
    res.status(500).json({
      message: error.message || "An error occurred during registration",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const userRecord = await admin.auth().getUserByEmail(email);
    if (!userRecord) {
      return res.status(404).json({ message: "User not found in Firebase" });
    }

    if (!userRecord.emailVerified) {
      return res.status(403).json({ message: "Email not verified. Please verify your email to log in." });
    }

    const role = userRecord.customClaims?.role || "job_seeker";
    const RoleModel = getRoleModel(role);

    const user = await User.findOne({ email, isDeleted: false })
      .select("+password")
      .populate("profileId")
      .populate({
        path: "roleSpecificData",
        model: RoleModel,
      });

    if (!user) {
      return res.status(404).json({ message: "User not found in DB" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = generateToken(user._id.toString(), user.role);
    const profileData = renderProfileWithFallback(user, "user", {
      authId: user.authId,
      email: user.email,
      role: user.role,
      profile: user.profileId || {},
      roleSpecificData: user.roleSpecificData || {},
    });

    res.status(200).json({
      message: "Login successful",
      token,
      profile: profileData,
    });
  } catch (error) {
    logger.error(`Login Error: ${error.message}`);
    res.status(500).json({
      message: error.message || "An error occurred during login",
    });
  }
};

exports.oauthLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "ID token required" });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    let user = await User.findOne({ authId: decodedToken.uid, isDeleted: false }).lean();

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

      const roleData = new JobSeeker({ userId: user._id });
      await roleData.save();
    }

    user = await User.findOne({ authId: decodedToken.uid, isDeleted: false })
      .populate("profileId")
      .populate({ path: "roleSpecificData", model: JobSeeker })
      .lean();

    const token = generateToken(user._id.toString(), user.role);
    const profileData = renderProfileWithFallback(user, "user", {
      authId: user.authId,
      email: user.email,
      role: user.role,
      profile: user.profileId || {},
      roleSpecificData: user.roleSpecificData || {},
    });

    res.status(200).json({
      message: isNewUser ? "User registered via OAuth" : "OAuth login successful",
      token,
      profile: profileData,
    });
  } catch (error) {
    logger.error(`OAuth Login Error: ${error.message}`);
    res.status(500).json({
      message: error.message || "OAuth login failed",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email, isDeleted: false }).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetLink = await admin.auth().generatePasswordResetLink(email);
    res.status(200).json({ message: "Password reset link sent", resetLink });
  } catch (error) {
    logger.error(`Forgot Password Error: ${error.message}`);
    res.status(500).json({
      message: error.message || "Error sending password reset link",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { userId } = req.user;
    await admin.auth().revokeRefreshTokens(userId);
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    logger.error(`Logout Error: ${error.message}`);
    res.status(500).json({
      message: error.message || "Logout failed",
    });
  }
};