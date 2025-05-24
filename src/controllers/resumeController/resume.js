const Resume = require("../../models/resume/ResumeModel");
const User = require("../../models/user/Users");
const JobSeeker = require("../../models/user/JobSeeker");
const { checkUserExists, checkRole } = require("../../utils/checks");
const { generateResume: generateAIResume } = require("../../services/aiService");

exports.generateResume = async (req, res) => {
  try {
    const { userId, role } = req.user;
    await checkUserExists(userId);
    checkRole(role, ["job_seeker"]);

    const existing = await Resume.findOne({ userId });
    if (existing) throw new Error("Resume already exists");

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false });
    if (!jobSeeker) throw new Error("Job seeker profile not found");

    const user = await User.findById(userId);
    if (!user) throw new Error("User profile not found");

    const resumeData = {
      fullName: user.fullName || "Not provided",
      bio: jobSeeker.bio || "Not provided",
      location: jobSeeker.jobPreferences?.location || "Not provided",
      contactInformation: {
        email: user.email,
        phone: jobSeeker.contactInformation?.phone || "Not provided"
      },
      socialLinks: jobSeeker.socialLinks || [],
      education: jobSeeker.education || [],
      experiences: jobSeeker.experience || [],
      projects: jobSeeker.projects || [],
      skills: jobSeeker.skills || [],
    };

    const generated = await generateAIResume(resumeData);

    const resume = new Resume({
      userId,
      ...generated
    });
    await resume.save();

    res.status(201).json({ message: "Resume generated", resume: generated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Rest of the file remains unchanged
exports.uploadResume = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // Authorization checks
    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can upload resumes");

    // Check if user already has a resume
    let resume = await Resume.findOne({ userId, isDeleted: false });
    if (resume) {
      throw new Error("You already have a resume. Please edit the existing one.");
    }

    if (!req.file) {
      throw new Error("No file uploaded");
    }

    // Create new resume with uploaded file
    resume = new Resume({
      userId,
      fullName: "", // Placeholder; can be updated later
      contactInformation: { email: (await User.findById(userId)).email },
      uploadedResume: req.file.path, // Cloudinary URL
    });

    await resume.save();

    res.status(201).json({
      message: "Resume uploaded successfully",
      resume: {
        userId: resume.userId,
        uploadedResume: resume.uploadedResume,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while uploading the resume",
    });
  }
};

exports.editResume = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const updates = req.body;

    // Authorization checks
    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can edit resumes");

    // Check if user has a resume
    let resume = await Resume.findOne({ userId, isDeleted: false });
    if (!resume) {
      throw new Error("No resume found. Please generate or upload a resume first.");
    }

    // Define allowed updates
    const allowedUpdates = [
      "fullName",
      "bio",
      "location",
      "contactInformation",
      "socialLinks",
      "education",
      "experiences",
      "projects",
      "skills",
    ];

    // Apply updates
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        resume[key] = updates[key];
      }
    });

    // Update uploaded resume if a new file is provided
    if (req.file) {
      resume.uploadedResume = req.file.path; // Cloudinary URL
    }

    await resume.save();

    res.status(200).json({
      message: "Resume updated successfully",
      resume: {
        userId: resume.userId,
        fullName: resume.fullName,
        bio: resume.bio,
        location: resume.location,
        contactInformation: resume.contactInformation,
        socialLinks: resume.socialLinks,
        education: resume.education,
        experiences: resume.experiences,
        projects: resume.projects,
        skills: resume.skills,
        uploadedResume: resume.uploadedResume,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while editing the resume",
    });
  }
};

exports.getResume = async (req, res) => {
  try {
    const { userId, role } = req.user;

    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can view their resume");

    const resume = await Resume.findOne({ userId });
    if (!resume) {
      throw new Error("No resume found");
    }

    res.status(200).json({
      message: "Resume retrieved successfully",
      resume: {
        userId: resume.userId,
        fullName: resume.fullName,
        bio: resume.bio,
        location: resume.location,
        contactInformation: resume.contactInformation,
        socialLinks: resume.socialLinks,
        education: resume.education,
        experiences: resume.experiences,
        projects: resume.projects,
        skills: resume.skills,
        uploadedResume: resume.uploadedResume,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the resume",
    });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const { userId, role } = req.user;

    // Authorization checks
    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can delete their resume");

    console.log("User ID:", userId);
    const resume = await Resume.findOne({ userId });
    if (!resume) {
      throw new Error("No resume found to delete");
    }

    await resume.softDelete();

    res.status(200).json({
      message: "Resume deleted successfully",
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the resume",
    });
  }
};