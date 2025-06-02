const { body, param, query } = require("express-validator");

exports.validateCreateJob = [
  body("title").notEmpty().withMessage("Title is required").trim(),
  body("description").notEmpty().withMessage("Description is required").trim(),
  body("location.country").notEmpty().withMessage("Country is required").trim(),
  body("location.city").notEmpty().withMessage("City is required").trim(),
  body("jobType")
    .notEmpty()
    .withMessage("Job type is required")
    .isIn(["Full-Time", "Part-Time", "Contract", "Internship"])
    .withMessage("Job type must be one of: Full-Time, Part-Time, Contract, Internship"),
  body("salary.min").notEmpty().withMessage("Minimum salary is required").isNumeric().withMessage("Minimum salary must be a number"),
  body("salary.max").notEmpty().withMessage("Maximum salary is required").isNumeric().withMessage("Maximum salary must be a number"),
  body("salary.currency")
    .notEmpty()
    .withMessage("Currency is required")
    .isIn(["USD", "EUR", "GBP", "INR"])
    .withMessage("Currency must be one of: USD, EUR, GBP, INR"),
  body("requirements").optional().isArray().withMessage("Requirements must be an array"),
  body("skills").optional().isArray().withMessage("Skills must be an array"),
  body("experienceLevel")
    .notEmpty()
    .withMessage("Experience level is required")
    .isIn(["Entry-Level", "Mid-Level", "Senior-Level"])
    .withMessage("Experience level must be one of: Entry-Level, Mid-Level, Senior-Level"),
  body("applicationDeadline")
    .notEmpty()
    .withMessage("Application deadline is required")
    .isISO8601()
    .withMessage("Application deadline must be a valid date")
    .custom((value) => {
      const deadline = new Date(value);
      const now = new Date();
      if (deadline <= now) {
        throw new Error("Application deadline must be in the future");
      }
      return true;
    }),
  body("status")
    .optional()
    .isIn(["Open", "Closed"])
    .withMessage("Status must be one of: Open, Closed"),
];

exports.validateUpdateJob = [
  param("jobId").isMongoId().withMessage("Invalid job ID"),
  body("title").optional().notEmpty().withMessage("Title cannot be empty").trim(),
  body("description").optional().notEmpty().withMessage("Description cannot be empty").trim(),
  body("location.country").optional().notEmpty().withMessage("Country cannot be empty").trim(),
  body("location.city").optional().notEmpty().withMessage("City cannot be empty").trim(),
  body("jobType")
    .optional()
    .isIn(["Full-Time", "Part-Time", "Contract", "Internship"])
    .withMessage("Job type must be one of: Full-Time, Part-Time, Contract, Internship"),
  body("salary.min").optional().isNumeric().withMessage("Minimum salary must be a number"),
  body("salary.max").optional().isNumeric().withMessage("Maximum salary must be a number"),
  body("salary.currency")
    .optional()
    .isIn(["USD", "EUR", "GBP", "INR"])
    .withMessage("Currency must be one of: USD, EUR, GBP, INR"),
  body("requirements").optional().isArray().withMessage("Requirements must be an array"),
  body("skills").optional().isArray().withMessage("Skills must be an array"),
  body("experienceLevel")
    .optional()
    .isIn(["Entry-Level", "Mid-Level", "Senior-Level"])
    .withMessage("Experience level must be one of: Entry-Level, Mid-Level, Senior-Level"),
  body("applicationDeadline")
    .optional()
    .isISO8601()
    .withMessage("Application deadline must be a valid date")
    .custom((value) => {
      const deadline = new Date(value);
      const now = new Date();
      if (deadline <= now) {
        throw new Error("Application deadline must be in the future");
      }
      return true;
    }),
  body("status")
    .optional()
    .isIn(["Open", "Closed"])
    .withMessage("Status must be one of: Open, Closed"),
];

exports.validateJobId = [
  param("jobId").isMongoId().withMessage("Invalid job ID"),
];

exports.validateUserId = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
];

exports.validateHireCandidate = [
  param("jobId").isMongoId().withMessage("Invalid job ID"),
  param("jobSeekerId").isMongoId().withMessage("Invalid job seeker ID"),
];

exports.validateGetJobs = [
  query("jobType")
    .optional()
    .isIn(["Full-Time", "Part-Time", "Contract", "Internship"])
    .withMessage("Job type must be one of: Full-Time, Part-Time, Contract, Internship"),
  query("experienceLevel")
    .optional()
    .isIn(["Entry-Level", "Mid-Level", "Senior-Level"])
    .withMessage("Experience level must be one of: Entry-Level, Mid-Level, Senior-Level"),
  query("location").optional().trim(),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1 }).withMessage("Limit must be a positive integer"),
];

exports.validateGetCompanyJobs = [
  param("companyId").isMongoId().withMessage("Invalid company ID"),
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1 }).withMessage("Limit must be a positive integer"),
];