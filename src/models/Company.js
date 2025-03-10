const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    logo: { type: String, default: null }, // Store Cloudinary URL
    industry: { type: String, required: true, trim: true },
    location: {
        country: { type: String, required: true },
        city: { type: String, required: true },
        address: { type: String, default: null },
    },
    website: { type: String }, // No regex to prevent validation issues
    description: { type: String, maxlength: 500 },
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employer" }],
    companySize: {
        type: String,
        enum: ["Startup", "Small (1-50)", "Medium (51-200)", "Large (200+)", "Enterprise"],
        default: "Small (1-50)"
    },
    foundedYear: { type: Number, min: 1800, max: new Date().getFullYear() },

    socialLinks: [
        {
            platform: String, 
            url: String
        }
    ],

    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "Admin" }], 

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

companySchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

companySchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

module.exports = mongoose.model("Company", companySchema);
