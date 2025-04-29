// src/models/user/CompanyAdmin.js
const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const companyAdminSchema = new mongoose.Schema(
  {
    mongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    permissions: {
      type: [String],
      enum: [
        "Manage Company Users",
        "Manage Company Jobs",
        "Fire Employers",
        "View Company Reports",
      ],
      default: [
        "Manage Company Users",
        "Manage Company Jobs",
        "Fire Employers",
        "View Company Reports",
      ],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdmin",
      default: null,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

// Apply soft delete middleware
applySoftDelete(companyAdminSchema);

module.exports = mongoose.model("CompanyAdmin", companyAdminSchema);