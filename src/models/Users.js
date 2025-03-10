const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    authId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["job_seeker", "employer", "company_admin", "super_admin"], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
