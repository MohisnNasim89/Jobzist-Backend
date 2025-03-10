const mongoose = require("mongoose");

const jobSeekerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String, required: true },
    profilePicture: { type: String },
    phoneNumber: { type: String },
    resume: { type: String },
    skills: [String],
    education: [
        {
            levelOfEdu: String,
            obtainedMarks: Number,
            institute: String,
            year: Number,
        },
    ],
    experience: [
        {
            jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
            companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
            companyName: { type: String, required: function () { return !this.companyId; } },
            title: { type: String, required: true },
            startDate: { type: Date, required: true },
            endDate: { type: Date, default: null },
            isCurrentJob: { type: Boolean, default: false },
            isDeleted: { type: Boolean, default: false }, 
        },
    ],
    jobPreferences: {
        jobType: [{ type: String, enum: ["Full_Time", "Part_Time", "Remote_Job"] }],
        location: String,
    },
    appliedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],
    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],
    status: { type: String, enum: ["Open to Work", "Employed"], default: "Open to Work" },
    socialLinks: [
        {
            platform: String,
            url: String
        }
    ],
}, { timestamps: true});

module.exports = mongoose.model("JobSeeker", jobSeekerSchema);
