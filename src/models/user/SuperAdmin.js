const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const superAdminSchema = new mongoose.Schema(
  {
    mongoId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    permissions: {
      type: [String],
      enum: [
        "manage_all_users", "manage_all_jobs", "manage_all_companies",
        "view_system_reports", "assign_admins", "remove_admins"
      ],
      default: [
        "manage_all_users", "manage_all_jobs", "manage_all_companies",
        "view_system_reports", "assign_admins", "remove_admins"
      ],
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin", default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

applySoftDelete(superAdminSchema);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);