const admin = require("../config/firebase");
const jwt = require("jsonwebtoken");
const User = require("../models/users/Users");
require("dotenv").config();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/** @desc Register new user (Email & Password) */
exports.register = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const userRecord = await admin.auth().createUser({ email, password });

    if (!userRecord) {
      return res.status(500).json({ message: "User creation failed" });
    }

    const newUser = new User({ authId: userRecord.uid, email, role });
    await newUser.save();

    // Send email verification link
    const emailVerificationLink = await admin.auth().generateEmailVerificationLink(email);

    return res.status(200).json({
      message: "Verification email sent",
      link: emailVerificationLink,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Login user (Email & Password) */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Check if the user exists in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Firebase Admin SDK does not verify passwords. Use Firebase Client SDK on the client side.
    const userRecord = await admin.auth().getUserByEmail(email);
    if (!userRecord) {
      return res.status(404).json({ message: "User not found in Firebase" });
    }

    // Generate a JWT for the application
    const token = generateToken(user.authId, user.role);

    return res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ message: "Invalid email or password" });
    }
    return res.status(500).json({ message: error.message });
  }
};

/** @desc OAuth Login (Google, Facebook, etc.) */
exports.oauthLogin = async (req, res) => {
  try {
    const { idToken, provider } = req.body;
    if (!idToken || !provider) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    let user = await User.findOne({ authId: decodedToken.uid });

    if (!user) {
      user = new User({ authId: decodedToken.uid, email: decodedToken.email, role: "job_seeker" });
      await user.save();
    }

    const token = generateToken(user.authId, user.role);

    return res.status(200).json({ message: "OAuth login successful", token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Forgot Password (Send Reset Link) */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const resetLink = await admin.auth().generatePasswordResetLink(email);

    return res.status(200).json({ message: "Password reset link sent", resetLink });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/** @desc Logout user (Client-Side Token Deletion) */
exports.logout = async (req, res) => {
  try {
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
