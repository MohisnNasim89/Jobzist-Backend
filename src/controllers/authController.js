const admin = require("../config/database/firebase");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const SuperAdmin = require("../models/user/SuperAdmin");
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

const sanitizeInput = (input) => {
  if (typeof input !== "string") return "";
  return input.replace(/[<>&'"]/g, "").trim().substring(0, 255);
};

exports.register = async (req, res) => {
  try {
    const { email, password, role, fullName } = req.body;
    if (!email || !password || !role || !fullName) {
      return res.status(400).json({ message: "Email, password, role, and full name are required" });
    }

    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);
    const sanitizedRole = sanitizeInput(role);
    const sanitizedFullName = sanitizeInput(fullName);

    const validRoles = ["job_seeker", "employer", "company_admin", "super_admin"];
    if (!validRoles.includes(sanitizedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email: sanitizedEmail }).lean();
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(sanitizedPassword, 10);

    const userRecord = await admin.auth().createUser({ email: sanitizedEmail, password: sanitizedPassword });
    const newUser = new User({ authId: userRecord.uid, email: sanitizedEmail, role: sanitizedRole, password: hashedPassword });
    await newUser.save();

    const userProfile = new UserProfile({ userId: newUser._id, fullName: sanitizedFullName });
    await userProfile.save();

    newUser.profileId = userProfile._id;
    await newUser.save();

    const RoleModel = getRoleModel(sanitizedRole);
    const roleData = new RoleModel({ userId: newUser._id });
    await roleData.save();

    newUser.roleSpecificData = roleData._id;
    await newUser.save();

    const emailVerificationLink = await admin.auth().generateEmailVerificationLink(sanitizedEmail);

    res.status(200).json({
      message: "Verification email sent",
      link: emailVerificationLink,
    });
  } catch (error) {
    logger.error(`Registration Error: ${error.message}`);
    res.status(500).json({
      message: "An error occurred during registration",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPassword = sanitizeInput(password);

    const userRecord = await admin.auth().getUserByEmail(sanitizedEmail);
    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = userRecord.customClaims?.role || "job_seeker";
    const RoleModel = getRoleModel(role);

    const user = await User.findOne({ email: sanitizedEmail, isDeleted: false })
      .select("+password")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found in DB" });
    }

    const isPasswordValid = await bcrypt.compare(sanitizedPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: { userId: user._id, role: user.role },
    });
  } catch (error) {
    logger.error(`Login Error: ${error.message}`);
    res.status(500).json({
      message: "An error occurred during login",
    });
  }
};

exports.oauthLogin = async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) return res.status(400).json({ message: "ID token required" });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    let user = await User.findOne({ authId: decodedToken.uid, isDeleted: false }).lean();

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const sanitizedEmail = sanitizeInput(decodedToken.email);
      const sanitizedName = sanitizeInput(decodedToken.name || "Unknown");
      const sanitizedRole = role ? sanitizeInput(role) : "job_seeker";

      const validRoles = ["job_seeker", "employer", "company_admin"];
      if (!validRoles.includes(sanitizedRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      user = new User({
        authId: decodedToken.uid,
        email: sanitizedEmail,
        role: sanitizedRole,
      });
      await user.save();

      const userProfile = new UserProfile({
        userId: user._id,
        fullName: sanitizedName,
      });
      await userProfile.save();

      user.profileId = userProfile._id;
      await user.save();

      const RoleModel = getRoleModel(sanitizedRole);
      const roleData = new RoleModel({ userId: user._id });
      await roleData.save();

      user.roleSpecificData = roleData._id;
      await user.save();
    }

    user = await User.findOne({ authId: decodedToken.uid, isDeleted: false })
      .select("_id role")
      .lean();

    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      message: isNewUser ? "User registered via OAuth" : "OAuth login successful",
      token,
      user: { userId: user._id, role: user.role },
    });
  } catch (error) {
    logger.error(`OAuth Login Error: ${error.message}`);
    res.status(500).json({
      message: "OAuth login failed",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body; 
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }

    const sanitizedEmail = sanitizeInput(email);
    const sanitizedNewPassword = sanitizeInput(newPassword);

    const user = await User.findOne({ email: sanitizedEmail, isDeleted: false }).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRecord = await admin.auth().getUserByEmail(sanitizedEmail);
    await admin.auth().updateUser(userRecord.uid, { password: sanitizedNewPassword });

    const hashedPassword = await bcrypt.hash(sanitizedNewPassword, 10);
    await User.findOneAndUpdate(
      { email: sanitizedEmail, isDeleted: false },
      { password: hashedPassword },
      { new: true }
    );

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    logger.error(`Forgot Password Error: ${error.message}`);
    res.status(500).json({
      message: "Error updating password",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { userId } = req.user;
    logger.info(`Attempting logout for userId: ${userId}`);

    const user = await User.findOne({ _id: userId, isDeleted: false }).select("authId").lean();
    if (!user || !user.authId) {
      throw new Error("No user record corresponding to the provided identifier");
    }

    const firebaseUid = user.authId;
    await admin.auth().revokeRefreshTokens(firebaseUid);
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    logger.error(`Logout Error: ${error.message}`);
    res.status(500).json({
      message: "Logout failed",
    });
  }
};