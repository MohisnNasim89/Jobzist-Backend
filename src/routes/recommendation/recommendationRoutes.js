const express = require("express");
const router = express.Router();
const { getJobRecommendations } = require("../../controllers/jobRecommendation/recommendationController");
const { verifyToken } = require("../../middlewares/authMiddleware");

router.get("/jobs", verifyToken, getJobRecommendations);

module.exports = router;