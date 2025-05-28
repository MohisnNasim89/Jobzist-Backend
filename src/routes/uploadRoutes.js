const express = require("express");
const upload = require("../config/multerConfig.js");

const {
  userIdValidationRules,
  companyIdValidationRules,
  validate,
} = require("../validations/uploadValidation");

const { verifyToken } = require("../middlewares/authMiddleware");
const { uploadProfilePic, uploadResume } = require("../controllers/uploadController");

const router = express.Router();

router.post("/:userId/profile-pic", verifyToken, userIdValidationRules, companyIdValidationRules, validate, upload.single("file"), uploadProfilePic);

router.post("/:userId/resume", verifyToken, userIdValidationRules, validate, upload.single("file"), uploadResume);

module.exports = router;