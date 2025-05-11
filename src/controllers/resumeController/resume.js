const Resume = require("../../models/resume/ResumeModel");
const User = require("../../models/user/Users");
const { checkUserExists, checkRole } = require("../../utils/checks");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

// Initialize OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

exports.generateResume = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const {
      fullName,
      bio,
      location,
      contactInformation,
      socialLinks,
      education,
      experiences,
      projects,
      skills,
    } = req.body;

    // Authorization checks
    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can generate resumes");

    // Check if user already has a resume
    let resume = await Resume.findOne({ userId, isDeleted: false });
    if (resume) {
      throw new Error("You already have a resume. Please edit the existing one.");
    }

    // Prepare the prompt for GPT-4o
    const prompt = `
      You are an expert resume generator. Create a structured resume in JSON format based on the following data:
      - Full Name: ${fullName}
      - Bio: ${bio || "Not provided"}
      - Location: ${location || "Not provided"}
      - Contact Information: ${JSON.stringify(contactInformation)}
      - Social Links: ${JSON.stringify(socialLinks || [])}
      - Education: ${JSON.stringify(education || [])}
      - Experiences: ${JSON.stringify(experiences || [])}
      - Projects: ${JSON.stringify(projects || [])}
      - Skills: ${JSON.stringify(skills || [])}

      The output should be a JSON object named "resume" with the following structure:
      {
        "resume": {
          "fullName": "string",
          "bio": "string",
          "location": "string",
          "contactInformation": { "email": "string", "phone": "string" },
          "socialLinks": [{ "platform": "string", "url": "string" }],
          "education": [{ "institution": "string", "degree": "string", "fieldOfStudy": "string", "startDate": "string", "endDate": "string", "description": "string" }],
          "experiences": [{ "company": "string", "position": "string", "startDate": "string", "endDate": "string", "description": "string" }],
          "projects": [{ "title": "string", "description": "string", "technologies": ["string"], "startDate": "string", "endDate": "string", "link": "string" }],
          "skills": ["string"]
        }
      }

      Ensure all dates are in "YYYY-MM-DD" format. Enhance the bio and descriptions to be professional and concise if needed.
    `;

    // Call OpenAI GPT-4o
    const response = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a professional resume generator." },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const generatedResume = JSON.parse(response.data.choices[0].message.content).resume;

    // Create new resume document
    resume = new Resume({
      userId,
      fullName: generatedResume.fullName,
      bio: generatedResume.bio,
      location: generatedResume.location,
      contactInformation: generatedResume.contactInformation,
      socialLinks: generatedResume.socialLinks,
      education: generatedResume.education,
      experiences: generatedResume.experiences,
      projects: generatedResume.projects,
      skills: generatedResume.skills,
    });

    await resume.save();

    res.status(201).json({
      message: "Resume generated successfully",
      resume: generatedResume,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while generating the resume",
    });
  }
};

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

    const resume = await Resume.findOne({ userId, isDeleted: false });
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

    // Find and soft delete the resume
    const resume = await Resume.findOne({ userId, isDeleted: false });
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