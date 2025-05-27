const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");

const {
  createCompany,
  getCompanyProfile,
  updateCompanyProfile,
  deleteCompany,
} = require("../../controllers/profile/companyProfileController"); 
const {
  companyValidationRules,
  companyIdValidationRules,
  validate,
} = require("../../validations/companyValidation"); 

router.post("/create", verifyToken, companyValidationRules, validate, createCompany);

router.get("/:companyId", companyIdValidationRules, validate, getCompanyProfile);

router.put("/:companyId", verifyToken, companyIdValidationRules, validate, updateCompanyProfile);

router.delete("/:companyId", verifyToken, companyIdValidationRules, validate, deleteCompany);

module.exports = router;