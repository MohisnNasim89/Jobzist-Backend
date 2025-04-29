const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const jobListingSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
});

const hiredCandidateSchema = new mongoose.Schema({
  jobSeekerId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker", required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  hiredAt: { type: Date, default: Date.now },
});

const employerSchema = new mongoose.Schema(
  {
    mongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    roleType: {
      type: String,
      enum: ["Company Employer", "Independent Recruiter"],
      default: "Independent Recruiter",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: function () {
        return this.roleType === "Company Employer";
      },
    },
    companyName: {
      type: String,
      required: function () {
        return this.roleType === "Company Employer";
      },
      trim: true,
    },
    jobListings: [jobListingSchema],
    hiredCandidates: [hiredCandidateSchema],
    status: {
      type: String,
      enum: ["Active", "Inactive", "Fired"],
      default: "Active",
    },
  },
  { timestamps: true }
);

// Apply soft delete middleware
applySoftDelete(employerSchema);

module.exports = mongoose.model("Employer", employerSchema);