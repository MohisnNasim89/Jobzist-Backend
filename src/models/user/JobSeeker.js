const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");
const coverLetterAi = require("../schemas/CoverLetterAi");

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  startYear: { type: Number, required: true, min: 1900 },
  endYear: { type: Number, min: 1900 },
  description: { type: String, trim: true },
});

const experienceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  description: { type: String, trim: true },
});

const jobPreferencesSchema = new mongoose.Schema({
  jobType: { 
    type: [String], 
    enum: { values: ["Full-Time", "Part-Time", "Contract", "Internship"], message: "{VALUE} is not a valid job type" },
    default: []
  },
  location: { type: String, trim: true },
  salaryExpectation: { type: Number, min: 0 },
});

const appliedJobSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  appliedAt: { type: Date, default: Date.now },
  coverLetter: { type: coverLetterAi, required: true },
  atsScore: { type: Number, default: null, min: 0, max: 100 },
  status: { 
    type: String, 
    enum: ["Applied", "Under Review", "Interview", "Offered", "Hired", "Rejected"], 
    default: "Applied" 
  },
});

const savedJobSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  savedAt: { type: Date, default: Date.now },
});

const projectsSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  summary: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  link: { type: String, required: true, trim: true },
});

const pendingApplicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  atsScore: { type: Number, default: null, min: 0, max: 100 },
  improvementSuggestions: { type: String, trim: true, default: null },
  coverLetter: { type: coverLetterAi, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const jobOfferSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  offeredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["Pending", "Accepted", "Rejected"], default: "Pending" },
});

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
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
      trim: true,
    },
    education: [educationSchema],
    experience: [experienceSchema],
    projects: [projectsSchema],
    jobPreferences: jobPreferencesSchema,
    appliedJobs: [appliedJobSchema],
    savedJobs: [savedJobSchema],
    pendingApplications: [pendingApplicationSchema],
    jobOffers: [jobOfferSchema], // New field to track job offers
    status: {
      type: String,
      enum: ["Open to Work", "Not Looking", "Hired"],
      default: "Open to Work",
    },
  },
  { timestamps: true }
);

applySoftDelete(jobSeekerSchema);

// Optimized indexes
jobSeekerSchema.index({ userId: 1 });
jobSeekerSchema.index({ "appliedJobs.jobId": 1 });
jobSeekerSchema.index({ "savedJobs.jobId": 1 });
jobSeekerSchema.index({ "jobOffers.jobId": 1 });

module.exports = mongoose.model("JobSeeker", jobSeekerSchema);