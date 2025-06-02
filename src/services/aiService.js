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
    const jsonMatch = text.match(/{[\s\S]*}/);
    if (!jsonMatch) throw new Error("No valid JSON object found in response");
    const cleanedText = jsonMatch[0]
      .replace(/```json\s*|\s*```/g, "")
      .trim();
    return JSON.parse(cleanedText);
  } catch (err) {
    throw new Error("AI returned invalid JSON: " + err.message);
  }
};

const validateATS = (data) => {
  const schema = Joi.object({
    atsScore: Joi.number().min(0).max(100).required(),
    improvementSuggestions: Joi.string().required(),
  });
  const { error, value } = schema.validate(data);
  if (error) throw new Error("Invalid ATS response format: " + error.message);
  return value;
};

const validateResume = (data) => {
  const schema = Joi.object({
    resume: Joi.object({
      fullName: Joi.string().required(),
      bio: Joi.string().required(),
      location: Joi.string().required(),
      contactInformation: Joi.object({
        email: Joi.string().email().required(),
        phone: Joi.string().allow("").required(),
      }).required(),
      socialLinks: Joi.array()
        .items(
          Joi.object({
            platform: Joi.string().required(),
            url: Joi.string().uri().required(),
          })
        )
        .required(),
      education: Joi.array()
        .items(
          Joi.object({
            degree: Joi.string().required(),
            institution: Joi.string().required(),
            startDate: Joi.number().required(),
            endDate: Joi.number().allow(null),
            description: Joi.string().allow(""),
          }).required()
        )
        .required(),
      experiences: Joi.array()
        .items(
          Joi.object({
            title: Joi.string().required(),
            company: Joi.string().required(),
            startDate: Joi.alternatives().try(Joi.string(), Joi.date()).required(),
            endDate: Joi.alternatives().try(Joi.string(), Joi.date(), Joi.allow(null)),
            description: Joi.string().allow(""),
          }).required()
        )
        .required(),
      projects: Joi.array()
        .items(
          Joi.object({
            title: Joi.string().required(),
            summary: Joi.string().allow(""),
            description: Joi.string().required(),
            link: Joi.string().uri().required(),
          }).required()
        )
        .required(),
      skills: Joi.array().items(Joi.string().required()).required(),
    }).required(),
  });
  const { error, value } = schema.validate(data, { stripUnknown: true });
  if (error) throw new Error("Invalid Resume structure: " + error.message);
  return value.resume;
};

const validateCoverLetter = (data) => {
  const schema = Joi.object({
    coverLetter: Joi.object({
      header: Joi.object({
        applicantName: Joi.string().required(),
        date: Joi.string().required(),
        companyName: Joi.string().required(),
        companyAddress: Joi.string().required(),
      }).required(),
      salutation: Joi.string().required(),
      introduction: Joi.string().required(),
      body: Joi.array()
        .items(Joi.string())
        .min(1)
        .required(),
      closing: Joi.object({
        callToAction: Joi.string().required(),
        signature: Joi.string().required(),
      }).required(),
    }).required(),
  });
  const { error, value } = schema.validate(data, { stripUnknown: true });
  if (error) throw new Error("Invalid Cover Letter structure: " + error.message);
  return value.coverLetter;
};

const truncateArray = (arr, limit = 5) =>
  Array.isArray(arr) ? arr.slice(0, limit) : [];

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
- Experiences: ${JSON.stringify(truncateArray(resume.experiences))}
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

exports.generateCoverLetter = async (
    resume,
    job,
    profile,
    companyName = "Unknown Company"
  ) => {
    const prompt = `
  Generate a structured JSON cover letter with the following sections: header, salutation, introduction, body (as an array of paragraphs), and closing. Keep the total word count between 200–300 words. Respond ONLY in this format:
  {
    "coverLetter": {
      "header": {
        "applicantName": "...",
        "date": "...",
        "companyName": "...",
        "companyAddress": "..."
      },
      "salutation": "...",
      "introduction": "...",
      "body": ["...", "..."],
      "closing": {
        "callToAction": "...",
        "signature": "..."
      }
    }
  }

  Use the Below data to generate the cover letter:
  Job:
  - Title: "${sanitize(job.title)}"
  - Description: "${sanitize(job.description)}"
  - Company: "${sanitize(companyName)}"

  Applicant:
  - Name: "${sanitize(resume.fullName)}"
  - Bio: "${sanitize(resume.bio)}"
  - Skills: ${JSON.stringify(truncateArray(resume.skills))}
  - Experiences: ${JSON.stringify(truncateArray(resume.experiences))}
  - Contact Information: ${JSON.stringify(resume.contactInformation)}
  - Projects: ${JSON.stringify(truncateArray(resume.projects))}
  `;

    try {
      const result = await model.generateContent(prompt);
      const rawResponse = result.response.text();
      return validateCoverLetter(parseJson(rawResponse));
    } catch (err) {
      console.error("Error in generateCoverLetter:", err.message);
      throw new Error("Failed to generate cover letter.");
    }
};

exports.generateResume = async (userData) => {
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
  } = userData;

  const prompt = `
Generate a structured JSON resume with this data.

- Name: "${sanitize(fullName)}"
- Bio: "${sanitize(bio)}"
- Location: "${sanitize(location)}"
- Contact Information: ${JSON.stringify(contactInformation)}
- Social Links: ${JSON.stringify(truncateArray(socialLinks))}
- Education: ${JSON.stringify(truncateArray(education))}
- Experiences: ${JSON.stringify(truncateArray(experiences))}
- Projects: ${JSON.stringify(truncateArray(projects))}
- Skills: ${JSON.stringify(truncateArray(skills))}

Respond ONLY in this format:
{
  "resume": {
    "fullName": "...",
    "bio": "...",
    "location": "...",
    "contactInformation": {"email": "...", "phone": "..."},
    "socialLinks": [{"platform": "...", "url": "..."}],
    "education": [{"degree": "...", "institution": "...", "startDate": 0, "endDate": 0, "description": "..."}],
    "experiences": [{"title": "...", "company": "...", "startDate": "...", "endDate": "...", "description": "..."}],
    "projects": [{"title": "...", "summary": "...", "description": "...", "link": "..."}],
    "skills": ["..."]
  }
}
`;

  try {
    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    const parsedResponse = parseJson(rawResponse);
    return validateResume(parsedResponse);
  } catch (err) {
    console.error("Error in generateResume:", err.message);
    throw new Error("Failed to generate resume.");
  }
};