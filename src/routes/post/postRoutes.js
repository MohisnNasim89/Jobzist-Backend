const express = require("express");
const upload = require("../../config/multerConfig");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  postIdValidationRules,
  createPostValidationRules,
  commentValidationRules,
  validate,
} = require("../../validations/postValidation");
const postController = require("../../controllers/post/postController");

const router = express.Router();

router.post("/", verifyToken, createPostValidationRules, validate, upload.array("media", 5), postController.createPost);

router.get("/:postId", verifyToken, postIdValidationRules, validate, postController.getPost);

router.get("/user/:userId", verifyToken, validate, postController.getUserPosts);

router.put("/:postId", verifyToken, postIdValidationRules, createPostValidationRules, validate, upload.array("media", 5), postController.updatePost);

router.delete("/:postId", verifyToken, postIdValidationRules, validate, postController.deletePost);

router.post("/:postId/like", verifyToken, postIdValidationRules, validate, postController.likePost);

router.post("/:postId/comment", verifyToken, postIdValidationRules, commentValidationRules, validate, postController.commentOnPost);

router.delete("/:postId/comment/:commentId", verifyToken, postIdValidationRules, validate, postController.deleteComment);

router.post("/:postId/share", verifyToken, postIdValidationRules, validate, postController.sharePost);

router.post("/:postId/save", verifyToken, postIdValidationRules, validate, postController.savePost);

router.patch("/:postId/visibility", verifyToken, postIdValidationRules, validate, postController.togglePostVisibility);

module.exports = router;