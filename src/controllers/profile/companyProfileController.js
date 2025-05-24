const Company = require("../../models/company/Company");
const Job = require("../../models/job/Job");
const logger = require("../../utils/logger");
const {
  checkRole,
  checkCompanyExists,
  checkCompanyAdminExists,
  renderProfileWithFallback,
} = require("../../utils/checks");

exports.createCompany = async (req, res) => {
  try {
    const { name, industry, location, website, description, companySize, foundedYear, socialLinks, logo } = req.body;
    const { userId, role } = req.user;

    checkRole(role, ["company_admin"], "Only company admins can create companies");
    const companyAdmin = await checkCompanyAdminExists(userId).select("_id companyId");

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
    });

    await company.save();

    companyAdmin.companyId = company._id;
    await companyAdmin.save();

    const profileData = renderProfileWithFallback(company, "company", {
      name: company.name || "Unnamed Company",
      industry: company.industry || "Unknown Industry",
      location: company.location || { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: company.website || "Not provided",
      websiteDomain: company.website ? new URL(company.website).hostname : "Not provided",
      description: company.description || "No description available",
      descriptionSummary: company.description
        ? company.description.split(" ").slice(0, 10).join(" ") || "No description"
        : "No description",
      companySize: company.companySize || "Unknown",
      foundedYear: company.foundedYear || "Unknown",
      socialLinks: company.socialLinks || [],
      logo: company.logo || "Not provided",
      jobListings: company.jobListings || [],
    });

    return res.status(201).json({
      message: "Company created successfully",
      company: { ...company.toObject(), profile: profileData },
    });
  } catch (error) {
    logger.error(`Error creating company: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while creating the company",
    });
  }
};

exports.getCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await checkCompanyExists(companyId)
      .select("name industry location website description companySize foundedYear socialLinks logo jobListings")
      .lean();

    const profileData = renderProfileWithFallback(company, "company", {
      name: company.name || "Unnamed Company",
      industry: company.industry || "Unknown Industry",
      location: company.location || { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: company.website || "Not provided",
      websiteDomain: company.website ? new URL(company.website).hostname : "Not provided",
      description: company.description || "No description available",
      descriptionSummary: company.description
        ? company.description.split(" ").slice(0, 10).join(" ") || "No description"
        : "No description",
      companySize: company.companySize || "Unknown",
      foundedYear: company.foundedYear || "Unknown",
      socialLinks: company.socialLinks || [],
      logo: company.logo || "Not provided",
      jobListings: company.jobListings || [],
    });

    return res.status(200).json({ profile: profileData });
  } catch (error) {
    logger.error(`Error retrieving company profile: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the company profile",
    });
  }
};

exports.updateCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updates = req.body;
    const { userId, role } = req.user;

    const company = await checkCompanyExists(companyId).select("_id");
    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can update company profiles");

    const companyAdmin = await checkCompanyAdminExists(userId).select("companyId");
    if (companyAdmin.companyId.toString() !== companyId.toString()) {
      throw new Error("Unauthorized: You are not an admin of this company");
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

    const profileData = renderProfileWithFallback(company, "company", {
      name: company.name || "Unnamed Company",
      industry: company.industry || "Unknown Industry",
      location: company.location || { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: company.website || "Not provided",
      websiteDomain: company.website ? new URL(company.website).hostname : "Not provided",
      description: company.description || "No description available",
      descriptionSummary: company.description
        ? company.description.split(" ").slice(0, 10).join(" ") || "No description"
        : "No description",
      companySize: company.companySize || "Unknown",
      foundedYear: company.foundedYear || "Unknown",
      socialLinks: company.socialLinks || [],
      logo: company.logo || "Not provided",
      jobListings: company.jobListings || [],
    });

    return res.status(200).json({
      message: "Company profile updated successfully",
      profile: profileData,
    });
  } catch (error) {
    logger.error(`Error updating company profile: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while updating the company profile",
    });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userId, role } = req.user;

    const company = await checkCompanyExists(companyId).select("_id");
    checkRole(role, ["company_admin"], "Unauthorized: Only company admins can delete companies");

    const companyAdmin = await checkCompanyAdminExists(userId).select("companyId");
    if (companyAdmin.companyId.toString() !== companyId.toString()) {
      throw new Error("Unauthorized: You are not an admin of this company");
    }

    await Job.updateMany({ companyId: companyId }, { $set: { isDeleted: true, deletedAt: new Date() } });

    await Company.findByIdAndUpdate(companyId, { isDeleted: true }); // Assuming softDelete sets isDeleted

    companyAdmin.companyId = null;
    await companyAdmin.save();

    return res.status(200).json({ message: "Company soft deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting company: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the company",
    });
  }
};