const { body, param } = require("express-validator");

const postIdValidationRules = [
  param("postId")
    .notEmpty()
    .withMessage("Post ID is required")
    .isMongoId()
    .withMessage("Invalid Post ID format"),
];

const createPostValidationRules = [
  body("content")
    .optional()
    .isString()
    .withMessage("Content must be a string")
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Content cannot exceed 5000 characters"),
  body("visibility")
    .optional()
    .isIn(["public", "connections", "private"])
    .withMessage("Visibility must be one of: public, connections, private"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  body("tags.*.type")
    .if(body("tags").exists())
    .isIn(["User", "Company"])
    .withMessage("Tag type must be either User or Company"),
  body("tags.*.id")
    .if(body("tags").exists())
    .isMongoId()
    .withMessage("Tag ID must be a valid MongoDB ID"),
];

const commentValidationRules = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isString()
    .withMessage("Comment content must be a string")
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed");
    error.status = 400;
    error.details = errors.array();
    throw error;
  }
  next();
};

module.exports = {
  postIdValidationRules,
  createPostValidationRules,
  commentValidationRules,
  validate,
};