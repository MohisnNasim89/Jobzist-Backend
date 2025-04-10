// src/models/user/Employer.js
const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const employerSchema = new mongoose.Schema(
  {
    userId: {
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
        return this.roleType === "Independent Recruiter" && !this.companyId;
      },
      trim: true,
    },
    jobListings: [
      {
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
        postedAt: { type: Date, default: Date.now },
      },
    ],
    hiredCandidates: [
      {
        jobSeekerId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker" },
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
        hiredAt: { type: Date, default: Date.now },
      },
    ],
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