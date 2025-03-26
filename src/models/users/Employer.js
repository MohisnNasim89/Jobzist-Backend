const mongoose = require("mongoose");

const employerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fullName: { type: String, required: true },
  roleType: { type: String, enum: ["Company_Employer", "Independent_Recruiter"], default: "Independent_Recruiter" },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
  companyName: { type: String, required: function () { return !this.companyId; } },
  phoneNumber: { type: String },
  jobListings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],
  hiredCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker" }],
  status: { type: String, enum: ["Active", "Inactive", "Fired"], default: "Active" },
}, { timestamps: true });

module.exports = mongoose.model("Employer", employerSchema);
