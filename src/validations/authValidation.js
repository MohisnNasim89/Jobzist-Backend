// src/validations/authValidation.js
const { body, validationResult } = require("express-validator");

const registerValidationRules = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*]/)
    .withMessage("Password must contain at least one special character"),
  body("role")
    .isIn(["job_seeker", "employer", "company_admin"])
    .withMessage("Invalid role"),
  body("fullName").notEmpty().withMessage("Full name is required").trim(),
];

const loginValidationRules = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const oauthValidationRules = [
  body("provider")
    .notEmpty()
    .withMessage("OAuth provider is required")
    .isIn(["google", "linkedin"])
    .withMessage("Invalid OAuth provider"),
  body("token").notEmpty().withMessage("OAuth token is required"),
];

const forgotPasswordValidationRules = [
  body("email").isEmail().withMessage("Valid email is required"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation error", errors: errors.array() });
  }
  next();
};

module.exports = {
  registerValidationRules,
  loginValidationRules,
  oauthValidationRules,
  forgotPasswordValidationRules,
  validate,
};