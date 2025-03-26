const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
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
        default: "Small"
    },
    foundedYear: { type: Number, min: 1800, max: new Date().getFullYear() },
    socialLinks: [{ platform: String, url: String }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "CompanyAdmin" }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employer" }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });

companySchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

companySchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Company", companySchema);

