const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
        role: { type: String, enum: ["super_admin", "company_admin"], required: true }, // Admin type
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            default: null
        },

        permissions: {
            type: [String],
            enum: [
                // Super Admin Permissions
                "manage_all_users",
                "manage_all_jobs",
                "manage_all_companies",
                "view_system_reports",
                "assign_admins",
                "remove_admins",

                // Company Admin Permissions
                "manage_company_users",
                "manage_company_jobs",
                "fire_employers",
                "view_company_reports",
            ],
            default: function () {
                return this.role === "super_admin"
                    ? [
                        "manage_all_users",
                        "manage_all_jobs",
                        "manage_all_companies",
                        "view_system_reports",
                        "assign_admins",
                        "remove_admins",
                    ]
                    : ["manage_company_users", "manage_company_jobs", "fire_employers", "view_company_reports"];
            },
        },

        status: { type: String, enum: ["active", "inactive"], default: "active" }, // Admin status
    },
    { timestamps: true } // Automatically adds createdAt & updatedAt
);

module.exports = mongoose.model("Admin", adminSchema);
