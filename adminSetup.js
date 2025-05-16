const mongoose = require("mongoose");
const User = require("./src/models/user/Users");
const SuperAdmin = require("./src/models/user/SuperAdmin");
const admin = require("./src/config/database/firebase");
const connectDB = require("./src/config/database/mongo");
require("dotenv").config();

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (question) => new Promise((resolve) => readline.question(question, resolve));

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Get email and password (from env or prompt)
    const email = process.env.SUPERADMIN_EMAIL || (await askQuestion("Enter SuperAdmin email: "));
    const password = process.env.SUPERADMIN_PASSWORD || (await askQuestion("Enter SuperAdmin password: "));
    readline.close();

    // Check if SuperAdmin already exists
    const existingUser = await User.findOne({ email, isDeleted: false }).select("_id");
    if (existingUser) {
      console.log("SuperAdmin user already exists with this email.");
      const token = await admin.auth().createCustomToken(existingUser._id);
      console.log("Custom token for existing user:", token);
      return;
    }

    // Create new user in Firebase Authentication
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: "SuperAdmin",
    });

    // Create new user in MongoDB
    const newUser = new User({
      authId: firebaseUser.uid,
      email,
      role: "super_admin",
    });
    await newUser.save();

    // Create SuperAdmin profile
    const superAdmin = new SuperAdmin({
      userId: newUser._id,
      assignedBy: null,
    });
    await superAdmin.save();

    // Assign custom claims for super_admin role
    await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: "super_admin" });

    // Generate custom token for the new SuperAdmin
    const token = await admin.auth().createCustomToken(firebaseUser.uid);
    console.log("SuperAdmin created successfully with email:", email);
    console.log("Custom token:", token);
  } catch (error) {
    console.error("Failed to create SuperAdmin:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

(async () => {
  await createSuperAdmin();
})();