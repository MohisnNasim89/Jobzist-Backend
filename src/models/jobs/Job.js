// src/models/job/Job.js
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Posted by user ID is required"],
    },
    description: {
      type: String,
      required: [true, "Job description is required"],
      trim: true,
    },
    location: {
      country: { type: String, required: [true, "Country is required"] },
      city: { type: String, required: [true, "City is required"] },
    },
    jobType: {
      type: String,
      enum: ["Full-Time", "Part-Time", "Contract", "Internship", "Freelance", "Remote"],
      required: [true, "Job type is required"],
    },
    salary: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      currency: { type: String, default: "USD" },
    },
    requirements: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    experienceLevel: {
      type: String,
      enum: ["Entry-Level", "Mid-Level", "Senior-Level", "Executive"],
      default: "Entry-Level",
    },
    applicationDeadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Open", "Closed", "Draft"],
      default: "Draft",
    },
    applicants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        appliedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["Applied", "Reviewed", "Interviewing", "Hired", "Rejected"],
          default: "Applied",
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Soft delete middleware
jobSchema.pre("find", function () {
  this.where({ isDeleted: false });
});

jobSchema.pre("findOne", function () {
  this.where({ isDeleted: false });
});

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;