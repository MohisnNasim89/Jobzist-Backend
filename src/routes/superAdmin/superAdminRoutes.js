const express = require("express");
const router = express.Router();
const superAdminController = require("../../controllers/superAdmin/superAdminController");
const { verifyToken } = require("../../middlewares/authMiddleware");

router.get("/users", verifyToken, superAdminController.getAllUsers);

router.delete("/users/:targetUserId", verifyToken, superAdminController.deleteUser);

router.get("/jobs", verifyToken, superAdminController.getAllJobs);

router.delete("/jobs/:jobId", verifyToken, superAdminController.deleteJob);

router.get("/companies", verifyToken, superAdminController.getAllCompanies);

router.delete("/companies/:companyId", verifyToken, superAdminController.deleteCompany);

router.get("/reports", verifyToken, superAdminController.getSystemReports);

router.post("/assign-admin", verifyToken, superAdminController.assignAdmin);

router.delete("/remove-admin/:targetUserId", verifyToken, superAdminController.removeAdmin);

router.post("/logs/clear", verifyToken, superAdminController.clearLogs);

module.exports = router;