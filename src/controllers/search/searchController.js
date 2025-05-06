const UserProfile = require("../../models/user/UserProfile");
const Company = require("../../models/company/Company");
const { checkUserExists } = require("../../utils/checks");

exports.searchUsersAndCompanies = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      throw new Error("Search query is required");
    }

    const users = await UserProfile.find({
      fullName: { $regex: query, $options: "i" },
      isDeleted: false,
    })
      .populate("userId", "email role")
      .limit(10);

    const companies = await Company.find({
      name: { $regex: query, $options: "i" },
      isDeleted: false,
    })
      .limit(10);

    res.status(200).json({
      message: "Search results retrieved successfully",
      users,
      companies,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while searching",
    });
  }
};

exports.getConnectionSuggestions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;

    checkUserExists(userId);
    checkUserExists(authenticatedUserId, "Unauthorized: You can only get suggestions for yourself");

    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    // Find mutual connections
    const connections = userProfile.connections;
    const suggestions = await UserProfile.find({
      _id: { $ne: userProfile._id },
      connections: { $in: connections },
      isDeleted: false,
    })
      .populate("userId", "email role")
      .limit(10);

    res.status(200).json({
      message: "Connection suggestions retrieved successfully",
      suggestions,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving connection suggestions",
    });
  }
};