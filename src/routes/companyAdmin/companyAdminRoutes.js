const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const rateLimit = require("express-rate-limit");
const checkCompanyAdminPermissions = require("../../middlewares/checkCompanyAdminPermissions");
const companyAdminController = require("../../controllers/companyAdmin/companyAdminController");

router.get("/users", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.getCompanyUsers);

router.put("/assign-role", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.assignCompanyUserRole);

router.delete("/fire-employers/:targetUserId", verifyToken, checkCompanyAdminPermissions("Fire Employers"), companyAdminController.fireEmployer);

router.get("/jobs", verifyToken, checkCompanyAdminPermissions("Manage Company Jobs"), companyAdminController.getCompanyJobs);

router.post("/jobs", verifyToken, checkCompanyAdminPermissions("Manage Company Jobs"), companyAdminController.createCompanyJob);

router.put("/jobs/:jobId", verifyToken, checkCompanyAdminPermissions("Manage Company Jobs"), companyAdminController.updateCompanyJob);

router.delete("/jobs/:jobId", verifyToken, checkCompanyAdminPermissions("Manage Company Jobs"), companyAdminController.deleteCompanyJob);

router.get("/reports", verifyToken, checkCompanyAdminPermissions("View Company Reports"), companyAdminController.getCompanyReports);

module.exports = router;