const express = require("express");
const upload = require("../../config/multerConfig");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  postIdValidationRules,
  createPostValidationRules,
  commentValidationRules,
  validate,
} = require("../../validations/postValidation");
const { createPost, getPost, getUserPosts, updatePost, deletePost, 
      likePost, commentOnPost, deleteComment, sharePost, savePost, togglePostVisibility} = require("../../controllers/post/postController");

const router = express.Router();

router.post("/", verifyToken, createPostValidationRules, validate, upload.single("media"), createPost );

router.get("/:postId", verifyToken, postIdValidationRules, validate, getPost );

router.get("/user/:userId", verifyToken, postIdValidationRules, validate, getUserPosts);

router.put("/:postId", verifyToken, postIdValidationRules, createPostValidationRules, validate, upload.single("media"), updatePost);

router.delete("/:postId", verifyToken, postIdValidationRules, validate, deletePost);

router.post("/:postId/like", verifyToken, postIdValidationRules, validate, likePost);

router.post("/:postId/comment", verifyToken, postIdValidationRules, commentValidationRules, validate, commentOnPost);

router.delete("/:postId/comment/:commentId", verifyToken, postIdValidationRules, validate, deleteComment);

router.post("/:postId/share", verifyToken, postIdValidationRules, validate, sharePost);

router.post("/:postId/save", verifyToken, postIdValidationRules, validate, savePost);

router.patch("/:postId/visibility", verifyToken, postIdValidationRules, validate, togglePostVisibility);

module.exports = router;