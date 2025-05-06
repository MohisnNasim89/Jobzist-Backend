const express = require("express");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  searchUsersAndCompanies,
  getConnectionSuggestions,
} = require("../../controllers/search/searchController");

const router = express.Router();

router.get("/search", verifyToken, searchUsersAndCompanies);
router.get("/suggestions/:userId", verifyToken, getConnectionSuggestions);

module.exports = router;