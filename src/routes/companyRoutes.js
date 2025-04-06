const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  createCompany,
  getCompanyProfile,
  updateCompanyProfile,
  deleteCompany,
} = require("../controllers/companyController");

router.post("/create", verifyToken, createCompany);
router.get("/:companyId/profile", getCompanyProfile);
router.put("/:companyId/profile", verifyToken, updateCompanyProfile);
router.delete("/:companyId", verifyToken, deleteCompany);

module.exports = router;