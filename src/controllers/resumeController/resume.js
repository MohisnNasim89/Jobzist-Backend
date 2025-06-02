const Resume = require("../../models/resume/ResumeModel");
const User = require("../../models/user/Users");
const JobSeeker = require("../../models/user/JobSeeker");
const logger = require("../../utils/logger");
const { checkUserExists, checkRole } = require("../../utils/checks");
const { generateResume: generateAIResume } = require("../../services/aiService");
const UserProfile = require("../../models/user/UserProfile");

exports.generateResume = async (req, res) => {
  try {
    const { userId, role } = req.user;
    await checkUserExists(userId);
    checkRole(role, ["job_seeker"]);

    const existing = await Resume.findOne({ userId }).lean();
    if (existing) throw new Error("Resume already exists");

    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false })
      .select("bio jobPreferences socialLinks education experience projects skills")
      .lean();
    if (!jobSeeker) throw new Error("Job seeker profile not found");

    const user = await User.findById(userId)
      .select("email")
      .lean();
    const userProfile = await UserProfile.findOne({ userId, isDeleted: false })
      .select("fullName bio location phoneNumber socialLinks")
      .lean();
    if (!user) throw new Error("User not found");
    if (!userProfile) throw new Error("User profile not found");

    const resumeData = {
      fullName: userProfile.fullName || "Not provided",
      bio: userProfile.bio || "Not provided",
      location: userProfile.location
        ? `${userProfile.location.city || "Not provided"}, ${userProfile.location.country || "Not provided"}`
        : "Not provided",
      contactInformation: {
        email: user.email,
        phone: userProfile.phoneNumber || "Not provided",
      },
      socialLinks: userProfile.socialLinks || [],
      education: jobSeeker.education || [],
      experiences: jobSeeker.experience || [],
      projects: jobSeeker.projects || [],
      skills: jobSeeker.skills || [],
    };

    const generated = await generateAIResume(resumeData);

    const resume = new Resume({
      userId,
      ...generated,
    });
    await resume.save();

    res.status(201).json({ message: "Resume generated", userId: userId });
  } catch (error) {
    logger.error(`Error generating resume: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message,
    });
  }
};

exports.editResume = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const updates = req.body;

    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can edit resumes");

    let resume = await Resume.findOne({ userId }).select("_id");
    if (!resume) {
      throw new Error("No resume found. Please generate a resume first.");
    }

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

    const resumeUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        resumeUpdates[key] = updates[key];
      }
    });

    await Resume.findByIdAndUpdate(resume._id, resumeUpdates);

    res.status(200).json({
      message: "Resume updated successfully",
      userId: userId,
    });
  } catch (error) {
    logger.error(`Error editing resume: ${error.message}`);
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

    const resume = await Resume.findOne({ userId })
      .select("userId fullName bio location contactInformation socialLinks education experiences projects skills")
      .lean();
    const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false })
      .select("resume")
      .lean();

    if (!resume && !jobSeeker?.resume) {
      throw new Error("No resume found");
    }

    res.status(200).json({
      message: "Resume retrieved successfully",
      resume: resume
        ? {
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
          }
        : {
            userId: userId,
            uploadedResume: jobSeeker.resume,
          },
    });
  } catch (error) {
    logger.error(`Error retrieving resume: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the resume",
    });
  }
};

exports.deleteResume = async (req, res) => {
  try {
    const { userId, role } = req.user;

    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can delete their resume");

    const resume = await Resume.findOne({ userId }).select("_id").lean();
    if (!resume) {
      throw new Error("No resume found to delete");
    }

    await Resume.deleteOne({ _id: resume._id });

    res.status(200).json({
      message: "Resume deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting resume: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the resume",
    });
  }
};