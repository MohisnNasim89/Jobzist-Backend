const UserProfile = require("../../models/user/UserProfile");
const Company = require("../../models/company/Company");
const logger = require("../../utils/logger");
const { checkUserExists } = require("../../utils/checks");

exports.searchUsersAndCompanies = async (req, res) => {
  try {
    const { query, userLimit = 10, companyLimit = 10, page = 1, role, location, industry } = req.query;

    if (!query || query.trim().length < 2) {
      throw new Error("Search query must be at least 2 characters long");
    }

    const sanitizedQuery = query.trim();
    const userSkip = (page - 1) * userLimit;
    const companySkip = (page - 1) * companyLimit;

    const userQuery = {
      isDeleted: false,
      $or: [
        { fullName: { $regex: sanitizedQuery, $options: "i" } },
        { skills: { $regex: sanitizedQuery, $options: "i" } },
      ],
    };
    if (role) userQuery["userId.role"] = role;
    if (location) userQuery["location.city"] = { $regex: location, $options: "i" };

    const companyQuery = {
      isDeleted: false,
      $or: [
        { name: { $regex: sanitizedQuery, $options: "i" } },
        { industry: { $regex: sanitizedQuery, $options: "i" } },
      ],
    };
    if (industry) companyQuery.industry = { $regex: industry, $options: "i" };
    if (location) companyQuery["location.city"] = { $regex: location, $options: "i" };

    const totalUsers = await UserProfile.countDocuments(userQuery);
    const totalCompanies = await Company.countDocuments(companyQuery);

    const users = await UserProfile.find(userQuery)
      .select("fullName userId skills location")
      .populate("userId", "email role")
      .skip(userSkip)
      .limit(parseInt(userLimit))
      .lean();

    const companies = await Company.find(companyQuery)
      .select("name industry location.city")
      .skip(companySkip)
      .limit(parseInt(companyLimit))
      .lean();

    const curatedUsers = users.map(user => ({
      userId: user.userId._id,
      fullName: user.fullName || "Unnamed User",
      email: user.userId.email || "Not provided",
      role: user.userId.role || "Unknown",
      skills: user.skills || [],
      city: user.location?.city || "Unknown",
    }));

    const curatedCompanies = companies.map(company => ({
      companyId: company._id,
      name: company.name || "Unnamed Company",
      industry: company.industry || "Unknown",
      city: company.location?.city || "Unknown",
    }));

    res.status(200).json({
      message: "Search results retrieved successfully",
      users: curatedUsers,
      companies: curatedCompanies,
      pagination: {
        page: parseInt(page),
        userLimit: parseInt(userLimit),
        companyLimit: parseInt(companyLimit),
        userPages: Math.ceil(totalUsers / userLimit),
        companyPages: Math.ceil(totalCompanies / companyLimit),
        totalUsers,
        totalCompanies,
      },
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

    const suggestionQuery = {
      $and: [
        { _id: { $ne: userProfile._id } },
        { userId: { $ne: userId } }, 
        { isDeleted: false },
        {
          $or: [
            { connections: { $in: connections } },
            { skills: { $in: userSkills } },
            userLocation ? { "location.city": { $regex: userLocation, $options: "i" } } : {},
          ],
        },
      ],
    };

    const totalSuggestions = await UserProfile.countDocuments(suggestionQuery);

    const suggestions = await UserProfile.find(suggestionQuery)
      .select("fullName userId skills location")
      .populate("userId", "email role")
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const curatedSuggestions = suggestions.map(suggestion => ({
      userId: suggestion.userId._id,
      fullName: suggestion.fullName || "Unnamed User",
      email: suggestion.userId.email || "Not provided",
      role: suggestion.userId.role || "Unknown",
      skills: suggestion.skills || [],
      city: suggestion.location?.city || "Unknown",
    }));

    res.status(200).json({
      message: "Connection suggestions retrieved successfully",
      suggestions: curatedSuggestions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalSuggestions,
        pages: Math.ceil(totalSuggestions / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving connection suggestions: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving connection suggestions",
    });
  }
};