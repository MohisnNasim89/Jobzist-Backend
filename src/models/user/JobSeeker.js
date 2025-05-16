const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const educationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  startYear: { type: Number, required: true },
  endYear: { type: Number },
  description: { type: String },
});

const experienceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  description: { type: String },
});

const jobPreferencesSchema = new mongoose.Schema({
  jobType: { type: [String], enum: { values: ["Full-Time", "Part-Time", "Contract", "Internship"], message: "{VALUE} is not a valid job type" } },
  location: { type: String },
  salaryExpectation: { type: Number },
});

const appliedJobSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  appliedAt: { type: Date, default: Date.now },
  coverLetter: { type: String, required: true }, 
  atsScore: { type: Number, default: null },
});

const savedJobSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  savedAt: { type: Date, default: Date.now },
});

const projectsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  summary: { type: String },
  description: { type: String, required: true },
  link: { type: String, required: true },
});

const pendingApplicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  atsScore: { type: Number, default: null },
  improvementSuggestions: { type: String, default: null },
  coverLetter: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
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
    },
    skills: {
      type: [String],
      default: [],
    },
    education: [educationSchema],
    experience: [experienceSchema],
    projects: [projectsSchema],
    jobPreferences: jobPreferencesSchema,
    appliedJobs: [appliedJobSchema],
    savedJobs: [savedJobSchema],
    pendingApplications: [pendingApplicationSchema],
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