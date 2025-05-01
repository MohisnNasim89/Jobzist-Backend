const Company = require("../../models/company/Company");
const Job = require("../../models/job/Job");
const {
  checkRole,
  checkCompanyExists,
  checkCompanyAdminExists,
  renderProfileWithFallback,
} = require("../../utils/checks");

exports.createCompany = async (req, res) => {
  const { name, industry, location, website, description, companySize, foundedYear, socialLinks, logo } = req.body;
  const { userId, role } = req.user;

  checkRole(role, ["company_admin"], "Only company admins can create companies");
  const companyAdmin = await checkCompanyAdminExists(userId);

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
};

exports.getCompanyProfile = async (req, res) => {
  const { companyId } = req.params;
  const company = await checkCompanyExists(companyId);

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
};

exports.updateCompanyProfile = async (req, res) => {
  const { companyId } = req.params;
  const updates = req.body;
  const { userId, role } = req.user;

  const company = await checkCompanyExists(companyId);
  checkRole(role, ["company_admin"], "Unauthorized: Only company admins can update company profiles");

  const companyAdmin = await checkCompanyAdminExists(userId);
  if (companyAdmin.companyId.toString() !== companyId.toString()) {
    throw new Error("Unauthorized: You are not an admin of this company", { status: 403 });
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
};

exports.deleteCompany = async (req, res) => {
  const { companyId } = req.params;
  const { userId, role } = req.user;

  const company = await checkCompanyExists(companyId);
  checkRole(role, ["company_admin"], "Unauthorized: Only company admins can delete companies");

  const companyAdmin = await checkCompanyAdminExists(userId);
  if (companyAdmin.companyId.toString() !== companyId.toString()) {
    throw new Error("Unauthorized: You are not an admin of this company", { status: 403 });
  }

  await Job.updateMany({ companyId: companyId }, { $set: { isDeleted: true, deletedAt: new Date() } });
  await company.softDelete();

  return res.status(200).json({ message: "Company soft deleted successfully" });
};