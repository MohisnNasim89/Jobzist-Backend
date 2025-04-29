const admin = require("../config/database/firebase");
const jwt = require("jsonwebtoken");
const User = require("../models/user/Users");
const UserProfile = require("../models/user/UserProfile");
const JobSeeker = require("../models/user/JobSeeker");
const Employer = require("../models/user/Employer");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const SuperAdmin = require("../models/user/SuperAdmin");
const renderProfile = require("../utils/renderProfile");
require("dotenv").config();

// Utility to generate JWT using MongoDB _id
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
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

    const userRecord = await admin.auth().createUser({ email, password });
    if (!userRecord) {
      return res.status(500).json({ message: "User creation failed" });
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
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({ message: "Email already exists" });
    }
    console.error("Error in register:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email, isDeleted: false })
      .populate({ path: "profileId", match: { isDeleted: false } })
      .populate({ path: "roleSpecificData", match: { isDeleted: false } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRecord = await admin.auth().getUserByEmail(email);
    if (!userRecord) {
      return res.status(404).json({ message: "User not found in Firebase" });
    }

    const token = generateToken(user._id.toString(), user.role);
    let profileData;
    try {
      profileData = renderProfile(user, "user");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
        authId: user.authId,
        email: user.email,
        role: user.role,
        profile: user.profileId || {},
        roleSpecificData: user.roleSpecificData || {},
      };
    }

    return res.status(200).json({
      message: "Login successful",
      token,
      profile: profileData,
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ message: "Invalid email or password" });
    }
    console.error("Error in login:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.oauthLogin = async (req, res) => {
  try {
    const { idToken, provider } = req.body;
    if (!idToken || !provider) {
      return res.status(400).json({ message: "Invalid request" });
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
    let profileData;
    try {
      profileData = renderProfile(user, "user");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
        authId: user.authId,
        email: user.email,
        role: user.role,
        profile: user.profileId || {},
        roleSpecificData: user.roleSpecificData || {},
      };
    }

    return res.status(200).json({
      message: isNewUser ? "User registered via OAuth" : "OAuth login successful",
      token,
      profile: profileData,
    });
  } catch (error) {
    console.error("Error in oauthLogin:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetLink = await admin.auth().generatePasswordResetLink(email);
    return res.status(200).json({ message: "Password reset link sent", resetLink });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ message: "User not found" });
    }
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error in logout:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};