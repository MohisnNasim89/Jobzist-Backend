// src/models/user/JobSeeker.js
const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const jobSeekerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    resume: {
      type: String,
      default: null,
    },
    skills: {
      type: [String],
      default: [],
    },
    education: [
      {
        degree: { type: String, required: true },
        fieldOfStudy: { type: String, required: true },
        institute: { type: String, required: true },
        grade: { type: String, default: null },
        startDate: { type: Date, required: true },
        endDate: { type: Date, default: null },
      },
    ],
    experience: [
      {
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
        companyName: { type: String },
        title: { type: String, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, default: null },
        isCurrentJob: { type: Boolean, default: false },
        description: { type: String, default: "" },
      },
    ],
    jobPreferences: {
      jobType: {
        type: [String],
        enum: ["Full-Time", "Part-Time", "Contract", "Internship", "Freelance", "Remote"],
        default: [],
      },
      location: {
        country: { type: String, default: null },
        city: { type: String, default: null },
      },
    },
    appliedJobs: [
      {
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
        appliedAt: { type: Date, default: Date.now },
      },
    ],
    savedJobs: [
      {
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
        savedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["Open to Work", "Not Looking", "Hired"],
      default: "Open to Work",
    },
  },
  { timestamps: true }
);

applySoftDelete(jobSeekerSchema);

module.exports = mongoose.model("JobSeeker", jobSeekerSchema);