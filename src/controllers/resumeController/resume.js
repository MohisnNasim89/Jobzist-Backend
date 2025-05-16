const Resume = require("../../models/resume/ResumeModel");
const User = require("../../models/user/Users");
const JobSeeker = require("../../models/user/JobSeeker");
const { checkUserExists, checkRole } = require("../../utils/checks");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Initialize Gemini 2.0 Flash
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

exports.generateResume = async (req, res) => {
  try {
    const { userId, role } = req.user;
    let {
      experiences,
      projects,
      skills,
    } = req.body;

    await checkUserExists(userId);
    checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can generate resumes");

    let resume = await Resume.findOne({ userId });
    if (resume) {
      throw new Error("You already have a resume. Please edit the existing one.");
    }

    const isBodyEmpty = Object.keys(req.body).length === 0;

    if (isBodyEmpty) {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false });
      if (!jobSeeker) {
        throw new Error("Job seeker profile not found. Please create a job seeker profile first.");
      }

      const userProfile = await User.findOne({ userId, isDeleted: false });
      if (!userProfile) {
        throw new Error("User profile not found. Please create a user profile first."); 
      }

      fullName = userProfile.fullName || "Not provided";
      bio = jobSeeker.bio || "Not provided";
      location = jobSeeker.jobPreferences?.location || "Not provided";
      contactInformation = {
        email: user.email || "Not provided",
        phone: jobSeeker.contactInformation?.phone || "Not provided",
      };
      socialLinks = jobSeeker.socialLinks || [];
      education = jobSeeker.education.map((edu) => ({
        institution: edu.institution,
        degree: edu.degree,
        startDate: edu.startYear ? `${edu.startYear}-01-01` : "Not provided",
        endDate: edu.endYear ? `${edu.endYear}-12-31` : "Not provided",
        description: edu.description || "Not provided",
      }));
      experiences = jobSeeker.experience.map((exp) => ({
        company: exp.company,
        position: exp.title,
        startDate: exp.startDate ? exp.startDate.toISOString().split("T")[0] : "Not provided",
        endDate: exp.endDate ? exp.endDate.toISOString().split("T")[0] : "Not provided",
        description: exp.description || "Not provided",
      }));
      projects = jobSeeker.projects.map((proj) => ({
        title: proj.title,
        description: proj.description,
        technologies: proj.technologies || [],
        startDate: proj.startDate ? proj.startDate.toISOString().split("T")[0] : "Not provided",
        endDate: proj.endDate ? proj.endDate.toISOString().split("T")[0] : "Not provided",
        link: proj.link,
      }));
      skills = jobSeeker.skills || [];
    }

    // Prepare the prompt for Gemini 2.0 Flash
    const prompt = `
      You are an expert resume generator. Create a structured resume in JSON format based on the following data:
      - Full Name: ${fullName || "Not provided"}
      - Bio: ${bio || "Not provided"}
      - Location: ${location || "Not provided"}
      - Contact Information: ${JSON.stringify(contactInformation || { email: "Not provided", phone: "Not provided" })}
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

      Ensure all dates are in "YYYY-MM-DD" format. Enhance the bio and descriptions to be professional and concise if needed. Return only the JSON content without any additional formatting`
    ;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();

    // Remove Markdown code block markers if present
    if (text.startsWith("```json") && text.endsWith("```")) {
      text = text.replace(/```json\s*|\s*```/g, "").trim();
    }

    const generatedResume = JSON.parse(text);

    // Create new resume document
    resume = new Resume({
      userId,
      fullName: generatedResume.resume.fullName,
      bio: generatedResume.resume.bio,
      location: generatedResume.resume.location,
      contactInformation: generatedResume.resume.contactInformation,
      socialLinks: generatedResume.resume.socialLinks,
      education: generatedResume.resume.education,
      experiences: generatedResume.resume.experiences,
      projects: generatedResume.resume.projects,
      skills: generatedResume.resume.skills,
    });

    await resume.save();

    res.status(201).json({
      message: "Resume generated successfully",
      resume: generatedResume.resume,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while generating the resume",
    });
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