const express = require("express");

const { userIdValidationRules, updateProfileValidationRules, validate } = require("../../validations/userValidation");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { updateUserProfile, deleteUser, getCurrentUser, createUserProfile} = require("../../controllers/profile/userProfileController");

const router = express.Router();

router.post("/:userId/create", verifyToken, userIdValidationRules, validate, createUserProfile);
router.get("/:userId/profile", verifyToken, userIdValidationRules, validate, getCurrentUser);
router.put("/:userId/update-profile", verifyToken, userIdValidationRules, updateProfileValidationRules, validate, updateUserProfile);
router.delete("/:userId/deactivate", verifyToken, deleteUser);

module.exports = router;