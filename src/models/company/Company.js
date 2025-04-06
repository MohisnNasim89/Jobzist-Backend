const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const companySchema = new mongoose.Schema(
  {
    profile: {
      name: { type: String, required: true, trim: true, unique: true },
      logo: { type: String, default: null },
      industry: { type: String, required: true, trim: true },
      location: {
        country: { type: String, required: true },
        city: { type: String, required: true },
        address: { type: String, default: null },
      },
      website: { type: String },
      description: { type: String, maxlength: 500 },
      companySize: {
        type: String,
        enum: ["Startup", "Small", "Medium", "Large", "Enterprise"],
        default: "Small",
      },
      foundedYear: { type: Number, min: 1800, max: new Date().getFullYear() },
      socialLinks: [{ platform: String, url: String }],
    },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "CompanyAdmin" }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employer" }],
  },
  { timestamps: true }
);

applySoftDelete(companySchema);

companySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

companySchema.index({ "profile.name": 1 });
companySchema.index({ admins: 1 });
companySchema.index({ employees: 1 });

module.exports = mongoose.model("Company", companySchema);