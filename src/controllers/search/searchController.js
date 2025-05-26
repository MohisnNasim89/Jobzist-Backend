const UserProfile = require("../../models/user/UserProfile");
const Company = require("../../models/company/Company");
const logger = require("../../utils/logger");
const { checkUserExists } = require("../../utils/checks");

exports.searchUsersAndCompanies = async (req, res) => {
  try {
    const { query, userLimit = 10, companyLimit = 10, page = 1 } = req.query;

    if (!query || query.trim().length < 2) {
      throw new Error("Search query must be at least 2 characters long");
    }

    const sanitizedQuery = query.trim();

    const userSkip = (page - 1) * userLimit;
    const companySkip = (page - 1) * companyLimit;

    // Search for users
    const users = await UserProfile.find({
      fullName: { $regex: sanitizedQuery, $options: "i" },
      isDeleted: false,
    })
      .select("fullName userId")
      .populate("userId", "email role")
      .skip(userSkip)
      .limit(parseInt(userLimit))
      .lean();

    const companies = await Company.find({
      name: { $regex: sanitizedQuery, $options: "i" },
      isDeleted: false,
    })
      .select("name")
      .skip(companySkip)
      .limit(parseInt(companyLimit))
      .lean();

    const curatedUsers = users.map(user => ({
      fullName: user.fullName,
      userId: user.userId._id,
      email: user.userId.email,
      role: user.userId.role,
    }));

    const curatedCompanies = companies.map(company => ({
      name: company.name,
      companyId: company._id,
    }));

    res.status(200).json({
      message: "Search results retrieved successfully",
      users: curatedUsers,
      companies: curatedCompanies,
      page: parseInt(page),
      userLimit: parseInt(userLimit),
      companyLimit: parseInt(companyLimit),
    });
  } catch (error) {
    logger.error(`Error searching users and companies: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while searching",
    });
  }
};

exports.getConnectionSuggestions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;
    const { limit = 10, page = 1 } = req.query;

    if (parseInt(page) < 1 || parseInt(limit) < 1) {
      throw new Error("Page and limit must be positive integers");
    }

    if (userId !== authenticatedUserId) {
      throw new Error("Unauthorized: You can only get suggestions for yourself");
    }

    await checkUserExists(userId);

    const userProfile = await UserProfile.findOne({ userId, isDeleted: false })
      .select("_id connections userId skills location")
      .lean();
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const connections = userProfile.connections || [];
    const userSkills = userProfile.skills || [];
    const userLocation = userProfile.location?.city?.toLowerCase() || "";

    const suggestions = await UserProfile.find({
      $and: [
        { _id: { $ne: userProfile._id } }, 
        { isDeleted: false },
        {
          $or: [
            { connections: { $in: connections } }, 
            { skills: { $in: userSkills } }, 
            userLocation ? { "location.city": { $regex: userLocation, $options: "i" } } : {}, 
          ],
        },
      ],
    })
      .select("fullName userId skills location")
      .populate("userId", "email role")
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    // Curate response
    const curatedSuggestions = suggestions.map(suggestion => ({
      userId: suggestion.userId._id,
      fullName: suggestion.fullName,
      email: suggestion.userId.email,
      role: suggestion.userId.role,
      skills: suggestion.skills,
      location: suggestion.location,
    }));

    res.status(200).json({
      message: "Connection suggestions retrieved successfully",
      suggestions: curatedSuggestions,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    logger.error(`Error retrieving connection suggestions: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving connection suggestions",
    });
  }
};