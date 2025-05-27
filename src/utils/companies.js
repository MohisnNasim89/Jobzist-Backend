const Company = require("../models/company/Company");
const logger = require("../utils/logger");

exports.getCompanies = async (req, res) => {
  try {
    const { search } = req.query;
    const query = search ? { name: new RegExp(search, 'i'), isDeleted: false } : { isDeleted: false };
    const companies = await Company.find(query)
      .select("_id name")
      .lean();
    res.status(200).json(companies);
  } catch (error) {
    logger.error(`Error retrieving companies: ${error.message}`);
    res.status(error.status || 500).json({ message: error.message });
  }
};