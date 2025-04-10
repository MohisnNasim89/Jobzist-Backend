// src/routes/userRoutes.js
const express = require("express");
const { userIdValidationRules, updateProfileValidationRules, validate } = require("../validations/userValidation");
const { verifyToken } = require("../middlewares/authMiddleware");
const { updateUserProfile, deleteUser, getCurrentUser } = require("../controllers/userController");

const router = express.Router();

// Routes
router.get("/:userId", verifyToken, userIdValidationRules, validate, getCurrentUser);
router.put("/:userId", verifyToken, userIdValidationRules, updateProfileValidationRules, validate, updateUserProfile);
router.delete("/:userId", verifyToken, userIdValidationRules, validate, deleteUser);

module.exports = router;