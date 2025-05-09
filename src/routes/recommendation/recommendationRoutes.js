const express = require("express");
const router = express.Router();
const { getJobRecommendations } = require("../controllers/recommendationsController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/jobs", authenticateToken, getJobRecommendations);

module.exports = router;