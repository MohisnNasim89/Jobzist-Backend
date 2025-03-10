const express = require("express");
const upload = require("../middleware/multer");

const router = express.Router();

router.post("/profile-pic", upload.single("file"), (req, res) => {
  res.status(200).json({ url: req.file.path });
});

router.post("/resume", upload.single("file"), (req, res) => {
  res.status(200).json({ url: req.file.path });
});

router.post("/document", upload.single("file"), (req, res) => {
  res.status(200).json({ url: req.file.path });
});

module.exports = router;
