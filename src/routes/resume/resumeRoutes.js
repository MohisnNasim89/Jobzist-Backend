const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const upload = require("../../config/multerConfig");
const resumeController = require("../../controllers/resumeController/resume");

router.post("/generate", verifyToken, resumeController.generateResume);

router.post("/upload", verifyToken, upload.single("resume"), resumeController.uploadResume);

router.put("/edit", verifyToken, upload.single("resume"), resumeController.editResume);

router.get("/", verifyToken, resumeController.getResume);

router.delete("/", verifyToken, resumeController.deleteResume);

module.exports = router;