const { GoogleGenerativeAI } = require("@google/generative-ai");
const Joi = require("joi");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const sanitize = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[`"'<>]/g, "")
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 1000);
};

const parseJson = (text) => {
  try {
    if (text.startsWith("```json")) {
      text = text.replace(/```json\s*|\s*```/g, "").trim();
    }
    return JSON.parse(text);
  } catch (err) {
    throw new Error("AI returned invalid JSON");
  }
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

const truncateArray = (arr, limit = 5) => Array.isArray(arr) ? arr.slice(0, limit) : [];

exports.getATSScore = async (resume, job) => {
  const prompt = `
You are an ATS evaluator. Return only JSON like this:
{
  "atsScore": 0-100,
  "improvementSuggestions": "short, helpful suggestions"
}

Job:
- Title: "${sanitize(job.title)}"
- Description: "${sanitize(job.description)}"
- Skills: ${JSON.stringify(truncateArray(job.skills))}
- Requirements: ${JSON.stringify(truncateArray(job.requirements))}
- Level: "${sanitize(job.experienceLevel)}"

Resume:
- Name: "${sanitize(resume.fullName)}"
- Bio: "${sanitize(resume.bio)}"
- Skills: ${JSON.stringify(truncateArray(resume.skills))}
- Experience: ${JSON.stringify(truncateArray(resume.experiences))}
- Projects: ${JSON.stringify(truncateArray(resume.projects))}
- Education: ${JSON.stringify(truncateArray(resume.education))}
`;

  try {
    const result = await model.generateContent(prompt);
    return validateATS(parseJson(result.response.text()));
  } catch (err) {
    console.error("Error in getATSScore:", err.message);
    throw new Error("Failed to generate ATS score.");
  }
};

exports.generateCoverLetter = async (resume, job, profile, companyName = "Unknown Company") => {
  const prompt = `
Write a 200–300 word professional cover letter in response to the job.

Job:
- Title: "${sanitize(job.title)}"
- Description: "${sanitize(job.description)}"
- Company: "${sanitize(companyName)}"

Applicant:
- Name: "${sanitize(resume.fullName)}"
- Bio: "${sanitize(resume.bio)}"
- Skills: ${JSON.stringify(truncateArray(resume.skills))}
- Experience: ${JSON.stringify(truncateArray(resume.experiences))}
- Contact: ${JSON.stringify(resume.contactInformation)}
`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error("Error in generateCoverLetter:", err.message);
    throw new Error("Failed to generate cover letter.");
  }
};

exports.generateResume = async (userData) => {
  const {
    fullName, bio, location,
    contactInformation, socialLinks, education,
    experiences, projects, skills
  } = userData;

  const prompt = `
Generate a structured JSON resume with this data.

- Name: "${sanitize(fullName)}"
- Bio: "${sanitize(bio)}"
- Location: "${sanitize(location)}"
- Contact: ${JSON.stringify(contactInformation)}
- Social Links: ${JSON.stringify(truncateArray(socialLinks))}
- Education: ${JSON.stringify(truncateArray(education))}
- Experiences: ${JSON.stringify(truncateArray(experiences))}
- Projects: ${JSON.stringify(truncateArray(projects))}
- Skills: ${JSON.stringify(truncateArray(skills))}

Respond ONLY in this format:
{
  "resume": {
    "fullName": "...",
    ...
  }
}
`;

  try {
    const result = await model.generateContent(prompt);
    return validateResume(parseJson(result.response.text()));
  } catch (err) {
    console.error("Error in generateResume:", err.message);
    throw new Error("Failed to generate resume.");
  }
};
