const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const upload = require("../../config/multerConfig");
const { aiRateLimiter } = require("../../middlewares/rateLimiter");
const resumeController = require("../../controllers/resumeController/resume");

router.post("/generate", aiRateLimiter, verifyToken, resumeController.generateResume);

router.put("/edit", verifyToken, upload.single("resume"), resumeController.editResume);

router.get("/me", verifyToken, resumeController.getResume);

router.delete("/me", verifyToken, resumeController.deleteResume);

module.exports = router;