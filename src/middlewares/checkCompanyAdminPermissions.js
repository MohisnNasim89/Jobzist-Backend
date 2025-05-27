const CompanyAdmin = require("../models/company/CompanyAdmin");

const checkCompanyAdminPermissions = (requiredPermission) => async (req, res, next) => {
  try {
    const { userId, role } = req.user;

    if (role !== "company_admin") {
      return res.status(403).json({ message: "Unauthorized: Only company admins can perform this action" });
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false })
      .select("status permissions")
      .lean();
    if (!companyAdmin || companyAdmin.status !== "Active") {
      return res.status(403).json({ message: "Company admin not found or inactive" });
    }

    if (!companyAdmin.permissions.includes(requiredPermission)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "An unexpected error occurred" });
  }
};

module.exports = checkCompanyAdminPermissions;