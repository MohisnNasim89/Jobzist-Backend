const { body, param, validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

const sanitize = (value) => {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  });
};

const createPostValidationRules = [
  body("content")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Content must be a string with a maximum length of 5000 characters")
    .customSanitizer(sanitize),
  body("visibility")
    .optional()
    .isIn(["public", "private"])
    .withMessage("Visibility must be either 'public' or 'private'")
    .customSanitizer(sanitize),
  body("tags")
    .optional()
    .custom((value) => {
      if (!value) return true;
      let tagsArray;
      try {
        tagsArray = typeof value === "string" ? JSON.parse(value) : value;
      } catch (error) {
        throw new Error("Tags must be a valid JSON array");
      }
      if (!Array.isArray(tagsArray)) {
        throw new Error("Tags must be an array");
      }
      for (const tag of tagsArray) {
        if (!tag.type || !["User", "Company"].includes(tag.type)) {
          throw new Error("Each tag must have a type of 'User' or 'Company'");
        }
        if (!tag.id || typeof tag.id !== "string") {
          throw new Error("Each tag must have a valid ID");
        }
      }
      return true;
    }),
  // Custom validator for media count (since express-validator can't directly validate files)
  (req, res, next) => {
    if (req.files && req.files.length > 5) {
      return res.status(400).json({ message: "Cannot upload more than 5 media files" });
    }
    next();
  },
];

const postIdValidationRules = [
  param("postId").isMongoId().withMessage("Invalid post ID"),
];

const commentValidationRules = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comment must be a string with a maximum length of 1000 characters")
    .customSanitizer(sanitize),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation error", errors: errors.array() });
  }
  next();
};

module.exports = {
  createPostValidationRules,
  postIdValidationRules,
  commentValidationRules,
  validate,
};