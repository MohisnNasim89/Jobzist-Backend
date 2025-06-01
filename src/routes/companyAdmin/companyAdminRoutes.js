const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const checkCompanyAdminPermissions = require("../../middlewares/checkCompanyAdminPermissions");
const companyAdminController = require("../../controllers/companyAdmin/companyAdminController");
const companyUtil = require("../../utils/companies");

router.get("/", companyUtil.getCompanies);

router.get("/:companyId/employer-requests", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.getCompanyEmployerApprovalRequests);

router.get("/:companyId/employers/:employerId/approval", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.getCompanyEmployerApproval);

router.put("/:companyId/employers/:employerId/approve", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.approveCompanyEmployer);

router.get("/:companyId/users", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.getCompanyUsers);

router.get("/:companyId/users/:targetUserId", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.getCompanyUser);

router.put("/:companyId/assign-role", verifyToken, checkCompanyAdminPermissions("Manage Company Users"), companyAdminController.assignCompanyUserRole);

router.delete("/:companyId/fire-employers/:targetUserId", verifyToken, checkCompanyAdminPermissions("Fire Employers"), companyAdminController.fireEmployer);

router.get("/:companyId/reports", verifyToken, checkCompanyAdminPermissions("View Company Reports"), companyAdminController.getCompanyReports);

module.exports = router;