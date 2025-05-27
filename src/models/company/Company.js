const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const locationSchema = new mongoose.Schema({
  country: { type: String, required: true },
  city: { type: String, required: true },
  address: { type: String, required: true },
});

const socialLinkSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  url: { type: String, required: true },
});

const jobListingSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
});

const companyEmployeesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
})

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    industry: { type: String, required: true },
    location: { type: locationSchema, required: true },
    website: { type: String },
    description: { type: String },
    companyAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyAdmin",
      required: true
    },
    companySize: {
      type: String,
      enum: ["Startup", "Small", "Medium", "Large", "Enterprise"],
      required: true,
    },
    foundedYear: { type: Number, required: true },
    socialLinks: [socialLinkSchema],
    logo: { type: String },
    jobListings: [jobListingSchema],
    companyEmployees: [companyEmployeesSchema],
  },
  { timestamps: true }
);

applySoftDelete(companySchema);

companySchema.index({ "companyEmployees.userId": 1 });

module.exports = mongoose.model("Company", companySchema);