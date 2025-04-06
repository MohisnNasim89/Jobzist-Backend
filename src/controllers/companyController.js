const Company = require("../models/company/Company");
const CompanyAdmin = require("../models/company/CompanyAdmin");
const renderProfile = require("../utils/renderProfile");

exports.createCompany = async (req, res) => {
  try {
    const { name, industry, location, website, description, companySize, foundedYear, socialLinks } = req.body;
    const user = req.user;

    if (user.role !== "company_admin") {
      return res.status(403).json({ message: "Only company admins can create companies" });
    }

    const company = new Company({
      profile: {
        name,
        industry,
        location,
        website,
        description,
        companySize,
        foundedYear,
        socialLinks,
      },
    });
    await company.save();

    const companyAdmin = await CompanyAdmin.findOne({ userId: user.mongoId });
    companyAdmin.companyId = company._id;
    await companyAdmin.save();

    company.admins.push(companyAdmin._id);
    await company.save();

    let profileData;
    try {
      profileData = renderProfile(company, "company");
    } catch (error) {
      return res.status(404).json({ message: error.message });
    }

    return res.status(201).json({ message: "Company created successfully", company: { ...company.toObject(), profile: profileData } });
  } catch (error) {
    console.error("Error in createCompany:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    let profileData;
    try {
      profileData = renderProfile(company, "company");
    } catch (error) {
      return res.status(404).json({ message: error.message });
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
    const user = req.user;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId: user.mongoId });
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not an admin of this company" });
    }

    // Update allowed fields in the profile subdocument
    const allowedUpdates = [
      "name", "industry", "location", "website",
      "description", "companySize", "foundedYear", "socialLinks", "logo"
    ];
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        company.profile[key] = updates[key];
      }
    });

    await company.save();

    let profileData;
    try {
      profileData = renderProfile(company, "company");
    } catch (error) {
      return res.status(404).json({ message: error.message });
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
    const user = req.user;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyAdmin = await CompanyAdmin.findOne({ userId: user.mongoId });
    if (!companyAdmin || companyAdmin.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You are not an admin of this company" });
    }

    await company.softDelete();
    return res.status(200).json({ message: "Company soft deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCompany:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};