// src/validations/uploadValidation.js
const { param, body, validationResult } = require("express-validator");

const userIdValidationRules = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
];

const companyIdValidationRules = [
  body("companyId")
    .optional()
    .isMongoId()
    .withMessage("Invalid company ID"),
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
  companyIdValidationRules,
  validate,
};