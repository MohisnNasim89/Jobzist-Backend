const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const companyAdminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null
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

companyAdminSchema.pre('save', async function(next) {
  if (this.isModified('companyId') && this.companyId) {
    const existingCompany = await mongoose.model("Company").findOne({ companyAdmin: this._id });
    if (existingCompany && existingCompany._id.toString() !== this.companyId.toString()) {
      const error = new Error("CompanyAdmin already associated with another company");
      return next(error);
    }
  }
  next();
});

applySoftDelete(companyAdminSchema);

module.exports = mongoose.model("CompanyAdmin", companyAdminSchema);