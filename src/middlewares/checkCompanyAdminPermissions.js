const CompanyAdmin = require("../models/company/CompanyAdmin");
const logger = require("../utils/logger");

const checkCompanyAdminPermissions = (requiredPermission) => async (req, res, next) => {
  try {
    const { userId, role } = req.user;

    if (role !== "company_admin") {
      return res.status(403).json({ message: "Unauthorized: Only company admins can perform this action" });
    }

    const cacheKey = `admin_${userId}_${requiredPermission}`;
    const cachedPermission = req.app.get(cacheKey);
    if (cachedPermission) {
      next();
      return;
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!companyAdmin || companyAdmin.status.toLowerCase() !== "active") {
      return res.status(403).json({ message: "Company admin not found or inactive" });
    }

    if (!companyAdmin.permissions.includes(requiredPermission)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    req.app.set(cacheKey, true, 3600000);
    next();
  } catch (error) {
    logger.error(`Permission check failed for user ${req.user.userId}: ${error.message}`);
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
};

module.exports = checkCompanyAdminPermissions;