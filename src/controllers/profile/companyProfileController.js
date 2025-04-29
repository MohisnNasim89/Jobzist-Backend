const Company = require("../../models/company/Company");
const CompanyAdmin = require("../../models/company/CompanyAdmin");
const renderProfile = require("../../utils/renderProfile");

exports.createCompany = async (req, res) => {
  try {
    const { name, industry, location, website, description, companySize, foundedYear, socialLinks, logo } = req.body;
    const { userId, role } = req.user;

    // Ensure only company admins can create companies
    if (role !== "company_admin") {
      return res.status(403).json({ message: "Only company admins can create companies" });
    }

    // Validate that a CompanyAdmin profile exists for the user
    const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
    if (!companyAdmin) {
      return res.status(404).json({ message: "Company admin profile not found" });
    }

    // Create the Company document with fields directly at the root level
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
    });

    await company.save();

    // Link the company to the CompanyAdmin
    companyAdmin.companyId = company._id;
    await companyAdmin.save();

    let profileData;
    try {
      profileData = renderProfile(company, "company");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
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
      };
    }

    return res.status(201).json({
      message: "Company created successfully",
      company: { ...company.toObject(), profile: profileData },
    });
  } catch (error) {
    console.error("Error in createCompany:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findOne({ _id: companyId, isDeleted: false });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(company, "company");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
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
      };
    }

    return res.status(200).json({ profile: profileData });
  } catch (error) {
    console.error("Error in getCompanyProfile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const updates = req.body;
    const { userId, role } = req.user;

    const company = await Company.findOne({ _id: companyId, isDeleted: false });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (role !== "company_admin") {
      return res.status(403).json({ message: "Unauthorized: Only company admins can update company profiles" });
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not an admin of this company" });
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

    let profileData;
    try {
      profileData = renderProfile(company, "company");
    } catch (error) {
      console.error("Error rendering profile:", error);
      profileData = {
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
      };
    }

    return res.status(200).json({
      message: "Company profile updated successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("Error in updateCompanyProfile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userId, role } = req.user;

    const company = await Company.findOne({ _id: companyId, isDeleted: false });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (role !== "company_admin") {
      return res.status(403).json({ message: "Unauthorized: Only company admins can delete companies" });
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId: userId, isDeleted: false });
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not an admin of this company" });
    }

    // Soft delete associated jobs
    await Job.updateMany({ companyId: companyId }, { $set: { isDeleted: true, deletedAt: new Date() } });

    await company.softDelete();
    return res.status(200).json({ message: "Company soft deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCompany:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};