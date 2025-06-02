const express = require("express");
const { verifyToken } = require("../../middlewares/authMiddleware");
const { getFeed } = require("../../controllers/feed/feedController");

const router = express.Router();

router.get("/:userId", verifyToken, getFeed);

module.exports = router;