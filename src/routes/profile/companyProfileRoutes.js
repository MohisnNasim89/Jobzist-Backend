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
  validate
} = require("../../validations/companyValidation");


router.post("/create", verifyToken, companyValidationRules, validate, createCompany);
router.get("/:companyId/profile", companyIdValidationRules, validate, getCompanyProfile);
router.put("/:companyId/update-profile", verifyToken, companyIdValidationRules, companyValidationRules, validate, updateCompanyProfile);
router.delete("/:companyId/deactivate", verifyToken, companyIdValidationRules, validate, deleteCompany);

module.exports = router;