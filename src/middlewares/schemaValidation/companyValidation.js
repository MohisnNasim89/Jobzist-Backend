// src/validations/companyValidation.js
const { body, param, validationResult } = require("express-validator");

const companyValidationRules = [
  body("name").optional().notEmpty().withMessage("Company name is required").trim(),
  body("industry").optional().notEmpty().withMessage("Industry is required").trim(),
  body("location.country").optional().notEmpty().withMessage("Country is required"),
  body("location.city").optional().notEmpty().withMessage("City is required"),
  body("location.address").optional().isString().withMessage("Address must be a string"),
  body("website").optional().isURL().withMessage("Website must be a valid URL"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string")
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("companySize")
    .optional()
    .isIn(["Startup", "Small", "Medium", "Large", "Enterprise"])
    .withMessage("Invalid company size"),
  body("foundedYear")
    .optional()
    .isInt({ min: 1800, max: new Date().getFullYear() })
    .withMessage(`Founded year must be between 1800 and ${new Date().getFullYear()}`),
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
];

const companyIdValidationRules = [
  param("companyId").isMongoId().withMessage("Invalid company ID"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation error", errors: errors.array() });
  }
  next();
};

module.exports = {
  companyValidationRules,
  companyIdValidationRules,
  validate,
};