const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const locationSchema = new mongoose.Schema({
  country: { type: String, required: true },
  city: { type: String, required: true },
});

const salarySchema = new mongoose.Schema({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  currency: { type: String, required: true, enum: ["USD", "EUR", "GBP", "INR"] },
});

const applicantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSeeker", required: true },
  appliedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["Applied", "Under Review", "Interview", "Hired", "Rejected"], default: "Applied" },
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
    title: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },
    location: { type: locationSchema, required: true },
    jobType: { type: String, enum: ["Full-Time", "Part-Time", "Contract", "Internship"], required: true },
    salary: { type: salarySchema, required: true },
    requirements: [{ type: String }],
    skills: [{ type: String }],
    experienceLevel: { type: String, enum: ["Entry-Level", "Mid-Level", "Senior-Level"], required: true },
    applicants: [applicantSchema], // Renamed from applications
    savedBy: [savedJobSchema],
    hiredCandidates: [hiredCandidateSchema],
    applicationDeadline: { type: Date, required: true },
    status: { type: String, enum: ["Draft", "Open", "Closed"], default: "Draft" }, // Added Draft status
  },
  { timestamps: true }
);

// Apply soft delete middleware
applySoftDelete(jobSchema);

// Add indexes for faster queries
jobSchema.index({ companyId: 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ status: 1 });

module.exports = mongoose.model("Job", jobSchema);