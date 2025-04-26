// src/routes/userRoutes.js
const express = require("express");
const { userIdValidationRules, updateProfileValidationRules, validate } = require("../middlewares/schemaValidation/userValidation");
const { verifyToken } = require("../middlewares/authMiddleware");
const { updateUserProfile, deleteUser, getCurrentUser } = require("../controllers/userController");

const router = express.Router();

// Routes
router.get("/:userId/profile", verifyToken, userIdValidationRules, validate, getCurrentUser);
router.put("/:userId/update-profile", verifyToken, userIdValidationRules, updateProfileValidationRules, validate, updateUserProfile);
router.delete("/:userId/deactivate", verifyToken, deleteUser);

module.exports = router;