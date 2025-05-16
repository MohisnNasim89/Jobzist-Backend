const express = require("express");
const router = express.Router();
const companyAdminController = require("../../controllers/companyAdmin/companyAdminController");
const jobPublicController = require("../../controllers/job/jobPublicController");
const { verifyToken } = require("../../middlewares/authMiddleware");

router.get("/company/users", verifyToken, companyAdminController.getCompanyUsers);
router.put("/company/users/:targetUserId/role", verifyToken, companyAdminController.assignCompanyUserRole);
router.delete("/company/employers/:targetUserId", verifyToken, companyAdminController.fireEmployer);
router.get("/company/jobs", verifyToken, jobPublicController.getCompanyJobs);
router.post("/company/jobs", verifyToken, companyAdminController.createCompanyJob);
router.put("/company/jobs/:jobId", verifyToken, companyAdminController.updateCompanyJob);
router.delete("/company/jobs/:jobId", verifyToken, companyAdminController.deleteCompanyJob);
router.get("/company/reports", verifyToken, companyAdminController.getCompanyReports);

module.exports = router;