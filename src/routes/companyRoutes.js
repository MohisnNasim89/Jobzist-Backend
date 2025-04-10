const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");

const {
  createCompany,
  getCompanyProfile,
  updateCompanyProfile,
  deleteCompany,
} = require("../controllers/companyController");

const {
  companyValidationRules, 
  companyIdValidationRules, 
  validate} = require("../middlewares/validationMiddleware");

router.post("/create", verifyToken, companyValidationRules, validate, createCompany);
router.get("/:companyId/profile", companyIdValidationRules, validate, getCompanyProfile);
router.put("/:companyId/profile", verifyToken, companyIdValidationRules, companyValidationRules, validate, updateCompanyProfile);
router.delete("/:companyId", verifyToken, companyIdValidationRules, validate, deleteCompany);

module.exports = router;