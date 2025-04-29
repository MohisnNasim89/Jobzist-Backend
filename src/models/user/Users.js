const mongoose = require("mongoose");
const { applySoftDelete, softDeleteRelated } = require("../../utils/softDelete");

const userSchema = new mongoose.Schema(
  {
    authId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ["job_seeker", "employer", "company_admin", "super_admin"],
      required: true,
    },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: "UserProfile" },
  },
  { timestamps: true }
);

applySoftDelete(userSchema);

userSchema.virtual("roleSpecificData", {
  ref: (doc) => {
    switch (doc.role) {
      case "job_seeker":
        return "JobSeeker";
      case "employer":
        return "Employer";
      case "company_admin":
        return "CompanyAdmin";
      case "super_admin":
        return "SuperAdmin";
      default:
        return null;
    }
  },
  localField: "_id",
  foreignField: "mongoId",
  justOne: true,
});

userSchema.set("toObject", { virtuals: true });
userSchema.set("toJSON", { virtuals: true });

userSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();

  // Soft delete the associated UserProfile
  await softDeleteRelated("UserProfile", { mongoId: this._id });

  switch (this.role) {
    case "job_seeker":
      await softDeleteRelated("JobSeeker", { mongoId: this._id });
      break;
    case "employer":
      await softDeleteRelated("Employer", { mongoId: this._id });
      break;
    case "company_admin":
      await softDeleteRelated("CompanyAdmin", { mongoId: this._id });
      break;
    case "super_admin":
      await softDeleteRelated("SuperAdmin", { mongoId: this._id });
      break;
  }
};

userSchema.pre("remove", async function (next) {
  await mongoose.model("UserProfile").deleteOne({ mongoId: this._id });
  switch (this.role) {
    case "job_seeker":
      await mongoose.model("JobSeeker").deleteOne({ mongoId: this._id });
      break;
    case "employer":
      await mongoose.model("Employer").deleteOne({ mongoId: this._id });
      break;
    case "company_admin":
      await mongoose.model("CompanyAdmin").deleteOne({ mongoId: this._id });
      break;
    case "super_admin":
      await mongoose.model("SuperAdmin").deleteOne({ mongoId: this._id });
      break;
  }
  next();
});

// Indexes for performance
userSchema.index({ authId: 1, email: 1 });

module.exports = mongoose.model("User", userSchema);