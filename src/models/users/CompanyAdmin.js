const mongoose = require("mongoose");

const companyAdminSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    permissions: {
      type: [String],
      enum: ["manage_company_users", "manage_company_jobs", "fire_employers", "view_company_reports"],
      default: ["manage_company_users", "manage_company_jobs", "fire_employers", "view_company_reports"],
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin", default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanyAdmin", companyAdminSchema);
