const Company = require("../../models/company/Company");
const Job = require("../../models/job/Job");
const Employer = require("../../models/user/Employer");
const User = require("../../models/user/Users");
const logger = require("../../utils/logger");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const { checkCompanyExists, renderProfileWithFallback } = require("../../utils/checks");

exports.createCompany = async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      name,
      industry,
      location,
      website,
      description,
      companySize,
      foundedYear,
      socialLinks,
      logo,
    } = req.body;

    const requiredFields = ["name", "industry", "location", "companySize", "foundedYear"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!location.country || !location.city || !location.address) {
      throw new Error("Location must include country, city, and address");
    }

    if (website) {
      try {
        new URL(website);
      } catch {
        throw new Error("Invalid website URL");
      }
    }

    if (socialLinks && Array.isArray(socialLinks)) {
      for (const link of socialLinks) {
        if (!link.platform || !link.url) {
          throw new Error("Social links must include platform and URL");
        }
        try {
          new URL(link.url);
        } catch {
          throw new Error(`Invalid URL for social link platform ${link.platform}`);
        }
      }
    }

    if (logo) {
      try {
        new URL(logo);
      } catch {
        throw new Error("Invalid logo URL");
      }
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId, isDeleted: false });
    if (!companyAdmin) {
      throw new Error("Company admin not found");
    }
    if (companyAdmin.companyId) {
      throw new Error("Unauthorized: CompanyAdmin already associated with a company");
    }

    const company = new Company({
      name,
      industry,
      location,
      website,
      description,
      companySize,
      foundedYear,
      socialLinks,
      logo,
      companyAdmin: companyAdmin._id,
      jobListings: [],
      companyEmployees: [],
    });

    await company.save();

    await CompanyAdmin.findByIdAndUpdate( companyAdmin._id, { companyId: company._id });

    const profileData = renderProfileWithFallback(company.toObject(), "company", {
      name: "Unnamed Company",
      industry: "Unknown Industry",
      location: { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: "Not provided",
      websiteDomain: "Not provided",
      description: "No description available",
      descriptionSummary: "No description",
      companySize: "Unknown",
      foundedYear: "Unknown",
      socialLinks: [],
      logo: "Not provided",
      jobListings: [],
    });

    return res.status(201).json({
      message: "Company created successfully",
      company: { companyId: company._id, profile: profileData },
    });
  } catch (error) {
    logger.error(`Error creating company: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await checkCompanyExists(companyId);

    const profileData = renderProfileWithFallback(company, "company", {
      name: "Unnamed Company",
      industry: "Unknown Industry",
      location: { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: "Not provided",
      websiteDomain: "Not provided",
      description: "No description available",
      descriptionSummary: "No description",
      companySize: "Unknown",
      foundedYear: "Unknown",
      socialLinks: [],
      logo: "Not provided",
      jobListings: [],
    });

    return res.status(200).json({ message: "Company profile retrieved successfully", profile: profileData });
  } catch (error) {
    logger.error(`Error retrieving company profile: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.updateCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updates = req.body;

    const company = await checkCompanyExists(companyId);

    // Validate updates
    if (updates.location) {
      if (!updates.location.country || !updates.location.city || !updates.location.address) {
        throw new Error("Location must include country, city, and address");
      }
    }
    if (updates.website) {
      try {
        new URL(updates.website);
      } catch {
        throw new Error("Invalid website URL");
      }
    }
    if (updates.socialLinks && Array.isArray(updates.socialLinks)) {
      for (const link of updates.socialLinks) {
        if (!link.platform || !link.url) {
          throw new Error("Social links must include platform and URL");
        }
        try {
          new URL(link.url);
        } catch {
          throw new Error(`Invalid URL for social link platform ${link.platform}`);
        }
      }
    }
    if (updates.logo) {
      try {
        new URL(updates.logo);
      } catch {
        throw new Error("Invalid logo URL");
      }
    }

    const allowedUpdates = [
      "name",
      "industry",
      "location",
      "website",
      "description",
      "companySize",
      "foundedYear",
      "socialLinks",
      "logo",
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        company[key] = updates[key];
      }
    });

    await company.save();

    const profileData = renderProfileWithFallback(company.toObject(), "company", {
      name: "Unnamed Company",
      industry: "Unknown Industry",
      location: { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: "Not provided",
      websiteDomain: "Not provided",
      description: "No description available",
      descriptionSummary: "No description",
      companySize: "Unknown",
      foundedYear: "Unknown",
      socialLinks: [],
      logo: "Not provided",
      jobListings: [],
    });

    return res.status(200).json({
      message: "Company profile updated successfully",
      profile: profileData,
    });
  } catch (error) {
    logger.error(`Error updating company profile: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await checkCompanyExists(companyId);

    // Soft-delete related jobs
    await Job.updateMany({ companyId: companyId }, { $set: { isDeleted: true, deletedAt: new Date() } });

    // Update Employers associated with the company
    await Employer.updateMany(
      { companyId: companyId },
      { $set: { status: "Inactive", companyId: null, companyName: null } }
    );

    // Update Users in companyEmployees (reset role to job_seeker)
    const userIds = company.companyEmployees.map((emp) => emp.userId);
    await User.updateMany(
      { _id: { $in: userIds }, role: "employer" },
      { $set: { role: "job_seeker" } }
    );

    // Soft-delete the company
    await company.softDelete();

    // Unlink CompanyAdmin
    await CompanyAdmin.findOneAndUpdate(
      { companyId: companyId, isDeleted: false },
      { $set: { companyId: null } }
    );

    return res.status(200).json({ message: "Company soft deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting company: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};