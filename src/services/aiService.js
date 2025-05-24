// services/aiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Joi = require("joi");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const sanitize = (text) => (text || "").replace(/[`]/g, "").substring(0, 1500);

const parseJson = (text) => {
  if (text.startsWith("```json")) {
    text = text.replace(/```json\s*|\s*```/g, "").trim();
  }
  return JSON.parse(text);
};

const validateATS = (data) => {
  const schema = Joi.object({
    atsScore: Joi.number().min(0).max(100).required(),
    improvementSuggestions: Joi.string().required(),
  });
  const { error, value } = schema.validate(data);
  if (error) throw new Error("Invalid ATS response format");
  return value;
};

const validateResume = (data) => {
  const schema = Joi.object({
    resume: Joi.object({
      fullName: Joi.string().required(),
      bio: Joi.string().required(),
      location: Joi.string().required(),
      contactInformation: Joi.object({
        email: Joi.string().required(),
        phone: Joi.string().required(),
      }),
      socialLinks: Joi.array().items(Joi.object({
        platform: Joi.string().required(),
        url: Joi.string().uri().required()
      })),
      education: Joi.array().items(Joi.object().required()),
      experiences: Joi.array().items(Joi.object().required()),
      projects: Joi.array().items(Joi.object().required()),
      skills: Joi.array().items(Joi.string().required()),
    }).required()
  });
  const { error, value } = schema.validate(data);
  if (error) throw new Error("Invalid Resume structure");
  return value.resume;
};

exports.getATSScore = async (resume, job) => {
  const prompt = `
You are an ATS evaluator. Return:
{
  "atsScore": 0-100,
  "improvementSuggestions": "short, helpful suggestions"
}
Job:
- Title: ${sanitize(job.title)}
- Description: ${sanitize(job.description)}
- Skills: ${JSON.stringify(job.skills)}
- Requirements: ${JSON.stringify(job.requirements)}
- Level: ${job.experienceLevel}

Resume:
- Name: ${sanitize(resume.fullName)}
- Bio: ${sanitize(resume.bio)}
- Skills: ${JSON.stringify(resume.skills)}
- Experience: ${JSON.stringify(resume.experiences)}
- Projects: ${JSON.stringify(resume.projects)}
- Education: ${JSON.stringify(resume.education)}
`;

  const result = await model.generateContent(prompt);
  return validateATS(parseJson(result.response.text()));
};

exports.generateCoverLetter = async (resume, job, profile, companyName = "Unknown Company") => {
  const prompt = `
Write a 200–300 word professional cover letter.

Job:
- Title: ${sanitize(job.title)}
- Description: ${sanitize(job.description)}
- Company: ${sanitize(companyName)}

Applicant:
- Name: ${sanitize(resume.fullName)}
- Bio: ${sanitize(resume.bio)}
- Skills: ${JSON.stringify(resume.skills)}
- Experience: ${JSON.stringify(resume.experiences)}
- Contact: ${JSON.stringify(resume.contactInformation)}
`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

exports.generateResume = async (userData) => {
  const {
    fullName, bio, location,
    contactInformation, socialLinks, education,
    experiences, projects, skills
  } = userData;

  const prompt = `
Generate a structured JSON resume with this data:
- Name: ${sanitize(fullName)}
- Bio: ${sanitize(bio)}
- Location: ${sanitize(location)}
- Contact: ${JSON.stringify(contactInformation)}
- Social Links: ${JSON.stringify(socialLinks)}
- Education: ${JSON.stringify(education)}
- Experiences: ${JSON.stringify(experiences)}
- Projects: ${JSON.stringify(projects)}
- Skills: ${JSON.stringify(skills)}

Respond in this format:
{
  "resume": {
    "fullName": "...",
    ...
  }
}
Return only JSON, no extra text.
`;

  const result = await model.generateContent(prompt);
  return validateResume(parseJson(result.response.text()));
};
