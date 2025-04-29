// src/validations/userValidation.js
const { body, param, validationResult } = require("express-validator");

const userIdValidationRules = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
];

const updateProfileValidationRules = [
  body("fullName").optional().notEmpty().withMessage("Full name cannot be empty").trim(),
  body("bio").optional().isString().withMessage("Bio must be a string"),
  body("location.country").optional().notEmpty().withMessage("Country cannot be empty"),
  body("location.city").optional().notEmpty().withMessage("City cannot be empty"),
  body("phoneNumber")
    .optional()
    .matches(/^\+\d{1,3}\d{9,}$/)
    .withMessage("Phone number must be in the format +1234567890"),
  body("socialLinks")
    .optional()
    .isArray()
    .withMessage("Social links must be an array"),
  body("socialLinks.*.platform")
    .optional()
    .notEmpty()
    .withMessage("Social link platform cannot be empty"),
  body("socialLinks.*.url")
    .optional()
    .isURL()
    .withMessage("Social link URL must be a valid URL"),
  body("profilePicture")
    .optional()
    .isURL()
    .withMessage("Profile picture must be a valid URL"),
  body("resume")
    .optional()
    .isURL()
    .withMessage("Resume must be a valid URL"),
  body("skills")
    .optional()
    .isArray()
    .withMessage("Skills must be an array of strings"),
  body("education")
    .optional()
    .isArray()
    .withMessage("Education must be an array"),
  body("education.*.degree")
    .optional()
    .notEmpty()
    .withMessage("Degree cannot be empty"),
  body("education.*.fieldOfStudy")
    .optional()
    .notEmpty()
    .withMessage("Field of study cannot be empty"),
  body("education.*.institute")
    .optional()
    .notEmpty()
    .withMessage("Institute cannot be empty"),
  body("education.*.startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),
  body("experience")
    .optional()
    .isArray()
    .withMessage("Experience must be an array"),
  body("experience.*.title")
    .optional()
    .notEmpty()
    .withMessage("Experience title cannot be empty"),
  body("experience.*.startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),
  body("jobPreferences.jobType")
    .optional()
    .isArray()
    .withMessage("Job type preferences must be an array")
    .isIn(["Full-Time", "Part-Time", "Contract", "Internship", "Freelance", "Remote"])
    .withMessage("Invalid job type"),
  body("roleType")
    .optional()
    .isIn(["Company Employer", "Independent Recruiter"])
    .withMessage("Invalid role type"),
  body("companyId")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID"),
  body("companyName")
    .optional()
    .notEmpty()
    .withMessage("Company name cannot be empty")
    .trim(),
  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .isIn(["Manage Company Users", "Manage Company Jobs", "Fire Employers", "View Company Reports"])
    .withMessage("Invalid permission"),
  body("status")
    .optional()
    .isIn(["Active", "Inactive", "Fired", "Open to Work", "Not Looking", "Hired"])
    .withMessage("Invalid status"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation error", errors: errors.array() });
  }
  next();
};

module.exports = {
  userIdValidationRules,
  updateProfileValidationRules,
  validate,
};