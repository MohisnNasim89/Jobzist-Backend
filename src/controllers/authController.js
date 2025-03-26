const admin = require("../config/firebase");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/users/Users");
require("dotenv").config();

/** Generate JWT Token */
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

/** @desc Register new user (Email & Password) */
exports.register = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    console.log(email);
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({ email, password });

    // Save user in MongoDB
    const newUser = new User({ authId: userRecord.uid, email, role });
    await newUser.save();

    const emailVerificationLink = await admin.auth().generateEmailVerificationLink(email);

    return res.status(200).json({ message: "Verification email sent", link: emailVerificationLink });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Login user (Email & Password) */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Verify user in Firebase
    const userRecord = await admin.auth().getUserByEmail(email);
    if (!userRecord.emailVerified) {
      return res.status(401).json({ message: "Please verify your email first." });
    }

    // Get user from MongoDB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate JWT Token
    const token = generateToken(user.authId, user.role);

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc OAuth Login (Google, Facebook, etc.) */
exports.oauthLogin = async (req, res) => {
  try {
    const { idToken, provider, role } = req.body;
    if (!idToken || !provider) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Verify Firebase Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Check if user exists in MongoDB
    let user = await User.findOne({ authId: decodedToken.uid });

    if (!user) {
      user = new User({ authId: decodedToken.uid, email: decodedToken.email, role });
      await user.save();
    }

    // Generate JWT Token
    const token = generateToken(user.authId, user.role);

    return res.status(200).json({ message: "OAuth login successful", token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Logout user */
exports.logout = async (req, res) => {
  try {
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
