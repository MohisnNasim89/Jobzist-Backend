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

    if (location && (!location.country || !location.city || !location.address)) {
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

    await CompanyAdmin.findByIdAndUpdate(companyAdmin._id, { companyId: company._id });

    return res.status(201).json({
      message: "Company created successfully",
      companyId: company._id,
    });
  } catch (error) {
    logger.error(`Error creating company: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.getCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const total = await Company.countDocuments({ isDeleted: false });
    const companies = await Company.find({ isDeleted: false })
      .select("_id name industry location.city logo")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const companyList = companies.map(company => ({
      companyId: company._id,
      name: company.name || "Unnamed Company",
      industry: company.industry || "Unknown Industry",
      city: company.location?.city || "Unknown",
      logo: company.logo || "Not provided",
    }));

    return res.status(200).json({
      message: "Companies retrieved successfully",
      companies: companyList,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error retrieving companies: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving companies",
    });
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

    return res.status(200).json({
      message: "Company profile retrieved successfully",
      profile: profileData,
    });
  } catch (error) {
    logger.error(`Error retrieving company profile: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.updateCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userId } = req.user;
    const updates = req.body;

    const company = await checkCompanyExists(companyId);

    // Authorization check: Only the associated CompanyAdmin can update
    const companyAdmin = await CompanyAdmin.findOne({ userId, companyId, isDeleted: false });
    if (!companyAdmin) {
      throw new Error("Unauthorized: Only the company admin can update this profile");
    }

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

    return res.status(200).json({
      message: "Company profile updated successfully",
      companyId: company._id,
    });
  } catch (error) {
    logger.error(`Error updating company profile: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userId } = req.user;

    const company = await checkCompanyExists(companyId);

    const companyAdmin = await CompanyAdmin.findOne({ userId, companyId, isDeleted: false });
    if (!companyAdmin) {
      throw new Error("Unauthorized: Only the company admin can delete this company");
    }

    await Job.updateMany({ companyId: companyId }, { $set: { isDeleted: true, deletedAt: new Date() } });

    await Employer.updateMany(
      { companyId: companyId },
      { $set: { status: "Inactive", companyId: null, companyName: null } }
    );

    const userIds = company.companyEmployees.map((emp) => emp.userId);
    await User.updateMany(
      { _id: { $in: userIds }, role: "employer" },
      { $set: { role: "job_seeker" } }
    );

    await company.softDelete();

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