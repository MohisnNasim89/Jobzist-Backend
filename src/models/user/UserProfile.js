const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: { type: String, required: true, trim: true },
    profilePicture: { type: String, default: null },
    bio: { type: String, maxlength: 500, default: null },
    location: {
      country: { type: String, default: null },
      city: { type: String, default: null },
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number (e.g., +1234567890)"],
      default: null,
    },
    socialLinks: [
      {
        platform: { type: String, enum: ["LinkedIn", "Twitter", "GitHub", "Portfolio"], required: true },
        url: { type: String, required: true },
      },
    ],
    isProfileComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

applySoftDelete(userProfileSchema);

userProfileSchema.pre("save", function (next) {
  const requiredFields = ["fullName", "location.country", "location.city"];
  this.isProfileComplete = requiredFields.every((field) => {
    const value = field.split(".").reduce((obj, key) => obj && obj[key], this);
    return value !== null && value !== undefined && value !== "";
  });
  next();
});


module.exports = mongoose.model("UserProfile", userProfileSchema);