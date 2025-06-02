const express = require("express");
const { setUploadType } = require("../middlewares/uploadMiddleware");
const upload = require("../config/multerConfig");
const { uploadProfilePic, uploadResume } = require("../controllers/uploadController");

const router = express.Router();

router.post("/:userId/profile-pic", setUploadType("profilePicture"), upload.single("file"), uploadProfilePic);

router.post("/:userId/resume", setUploadType("resume"), upload.single("file"), uploadResume);

module.exports = router;