const express = require("express");
const upload = require("../../config/multerConfig");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  postIdValidationRules,
  createPostValidationRules,
  commentValidationRules,
  validate,
} = require("../../validations/postValidation");
const {
  createPost,
  getPost,
  getUserPosts,
  updatePost,
  deletePost,
  likePost,
  commentOnPost,
  sharePost,
  savePost,
} = require("../../controllers/post/postController");

const router = express.Router();

// Create a post (with optional media upload)
router.post(
  "/",
  verifyToken,
  createPostValidationRules,
  validate,
  upload.single("media"),
  createPost
);

// Get a single post
router.get("/:postId", postIdValidationRules, validate, getPost);

// Get all posts by a user
router.get("/user/:userId", postIdValidationRules, validate, getUserPosts);

// Update a post (with optional media upload)
router.put(
  "/:postId",
  verifyToken,
  postIdValidationRules,
  createPostValidationRules,
  validate,
  upload.single("media"),
  updatePost
);

// Delete a post
router.delete(
  "/:postId",
  verifyToken,
  postIdValidationRules,
  validate,
  deletePost
);

// Like/unlike a post
router.post(
  "/:postId/like",
  verifyToken,
  postIdValidationRules,
  validate,
  likePost
);

// Comment on a post
router.post(
  "/:postId/comment",
  verifyToken,
  postIdValidationRules,
  commentValidationRules,
  validate,
  commentOnPost
);

// Share a post
router.post(
  "/:postId/share",
  verifyToken,
  postIdValidationRules,
  validate,
  sharePost
);

// Save/unsave a post
router.post(
  "/:postId/save",
  verifyToken,
  postIdValidationRules,
  validate,
  savePost
);

module.exports = router;