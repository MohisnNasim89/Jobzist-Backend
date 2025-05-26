const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");
const coverLetterAi = require("../schemas/CoverLetterAi");

const locationSchema = new mongoose.Schema({
  country: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
});

const salarySchema = new mongoose.Schema({
  min: { type: Number, required: true, min: 0 },
  max: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, enum: ["USD", "EUR", "GBP", "INR"] },
});

const applicantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker", required: true },
  appliedAt: { type: Date, default: Date.now },
  resume: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["Applied", "Under Review", "Interview", "Offered", "Hired", "Rejected"], 
    default: "Applied" 
  },
  coverLetter: { type: coverLetterAi, required: true },
  atsScore: { type: Number, default: null, min: 0, max: 100 },
});

const savedJobSchema = new mongoose.Schema({
  jobSeekerId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker", required: true },
  savedAt: { type: Date, default: Date.now },
});

const hiredCandidateSchema = new mongoose.Schema({
  jobSeekerId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker", required: true },
  hiredAt: { type: Date, default: Date.now },
});

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, trim: true },
    location: { type: locationSchema, required: true },
    jobType: { type: String, enum: ["Full-Time", "Part-Time", "Contract", "Internship"], required: true },
    salary: { type: salarySchema, required: true },
    requirements: [{ type: String, trim: true }],
    skills: [{ type: String, trim: true }],
    experienceLevel: { type: String, enum: ["Entry-Level", "Mid-Level", "Senior-Level"], required: true },
    applicants: [applicantSchema],
    savedBy: [savedJobSchema],
    hiredCandidates: [hiredCandidateSchema],
    applicationDeadline: { type: Date, required: true },
    status: { type: String, enum: ["Draft", "Open", "Closed"], default: "Open" },
  },
  { timestamps: true }
);

applySoftDelete(jobSchema);

// Optimized indexes
jobSchema.index({ companyId: 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ "applicants.userId": 1 }); // For faster applicant lookups
jobSchema.index({ applicationDeadline: 1 });

module.exports = mongoose.model("Job", jobSchema);