const UserProfile = require("../../models/user/UserProfile");
const Notification = require("../../models/notification/Notification");
const Company = require("../../models/company/Company");
const { checkUserExists } = require("../../utils/checks");
const { emitNotification } = require("../../socket/socket");
const logger = require("../../utils/logger");

exports.sendConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    if (userId.toString() === targetUserId.toString()) {
      const error = new Error("You cannot send a connection request to yourself");
      error.status = 400;
      throw error;
    }

    const user = await checkUserExists(userId);
    const targetUser = await checkUserExists(targetUserId);

    const userProfile = await UserProfile.findOne({ userId })
      .select("connections connectionRequests fullName");
    const targetProfile = await UserProfile.findOne({ userId: targetUserId })
      .select("connections connectionRequests fullName");

    if (!userProfile || !targetProfile) {
      const error = new Error("User profile not found");
      error.status = 404;
      throw error;
    }

    if (userProfile.connections.some((conn) => conn.toString() === targetUserId)) {
      const error = new Error("You are already connected with this user");
      error.status = 400;
      throw error;
    }

    const mutualRequest = userProfile.connectionRequests.find(
      (req) => req.fromUserId.toString() === targetUserId.toString() && req.status === "pending"
    );

    if (mutualRequest) {
      await UserProfile.updateOne(
        { userId },
        {
          $push: { connections: targetUserId },
          $pull: { connectionRequests: { fromUserId: targetUserId } },
        },
      );
      await UserProfile.updateOne(
        { userId: targetUserId },
        { $push: { connections: userId } },
      );

      const userNotification = new Notification({
        userId: userId,
        type: "connectionRequest",
        relatedId: targetUserId,
        message: `${targetProfile.fullName} accepted your connection request`,
      });
      const targetNotification = new Notification({
        userId: targetUserId,
        type: "connectionRequest",
        relatedId: userId,
        message: `${userProfile.fullName} accepted your connection request`,
      });

      await userNotification.save();
      await targetNotification.save();
      emitNotification(userId.toString(), userNotification);
      emitNotification(targetUserId.toString(), targetNotification);

      return res.status(200).json({ message: "Mutual connection established successfully" });
    }

    const existingRequest = targetProfile.connectionRequests.find(
      (req) => req.fromUserId.toString() === userId.toString()
    );
    if (existingRequest) {
      const error = new Error("Connection request already sent");
      error.status = 400;
      throw error;
    }

    await UserProfile.updateOne(
      { userId: targetUserId },
      { $push: { connectionRequests: { fromUserId: userId, status: "pending" } } }
    );

    const notification = new Notification({
      userId: targetUserId,
      type: "connectionRequest",
      relatedId: userId,
      message: `${userProfile.fullName} sent you a connection request`,
    });
    await notification.save();
    emitNotification(targetUserId.toString(), notification);

    res.status(200).json({ message: "Connection request sent successfully" });
  } catch (error) {
    logger.error(`Error sending connection request: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while sending the connection request",
    });
  }
};

exports.acceptConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { requestUserId } = req.params;

    const userProfile = await UserProfile.findOne({ userId })
      .select("connectionRequests fullName");
    const requesterProfile = await UserProfile.findOne({ userId: requestUserId })
      .select("fullName");

    if (!userProfile || !requesterProfile) {
      const error = new Error("User profile not found");
      error.status = 404;
      throw error;
    }

    const requestExists = userProfile.connectionRequests.find(
      (req) => req.fromUserId.toString() === requestUserId.toString() && req.status === "pending"
    );
    if (!requestExists) {
      const error = new Error("No pending connection request found");
      error.status = 400;
      throw error;
    }

    await UserProfile.updateOne(
      { userId },
      {
        $push: { connections: requestUserId },
        $pull: { connectionRequests: { fromUserId: requestUserId } },
      },
    );
    await UserProfile.updateOne(
      { userId: requestUserId },
      { $push: { connections: userId } },
    );

    const notification = new Notification({
      userId: requestUserId,
      type: "connectionRequest",
      relatedId: userId,
      message: `${userProfile.fullName} accepted your connection request`,
    });
    await notification.save();
    emitNotification(requestUserId.toString(), notification);

    res.status(200).json({ message: "Connection request accepted successfully" });
  } catch (error) {
    logger.error(`Error accepting connection request: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while accepting the connection request",
    });
  }
};

exports.rejectConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { requestUserId } = req.params;

    const userProfile = await UserProfile.findOne({ userId })
      .select("connectionRequests")
      .lean();
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const requestExists = userProfile.connectionRequests.some(
      (req) => req.fromUserId.toString() === requestUserId.toString() && req.status === "pending"
    );
    if (!requestExists) {
      throw new Error("No pending connection request found");
    }

    await UserProfile.updateOne(
      { userId },
      { $set: { "connectionRequests.$[req].status": "rejected" } },
      { arrayFilters: [{ "req.fromUserId": requestUserId }] }
    );

    res.status(200).json({ message: "Connection request rejected successfully" });
  } catch (error) {
    logger.error(`Error rejecting connection request: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while rejecting the connection request",
    });
  }
};

exports.removeConnection = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    const userProfile = await UserProfile.findOne({ userId }).select("connections");
    if (!userProfile) {
      const error = new Error("Current user profile not found");
      error.status = 404;
      throw error;
    }

    const targetProfile = await UserProfile.findOne({ userId: targetUserId }).select("connections");
    if (!targetProfile) {
      const error = new Error("Target user profile not found");
      error.status = 404;
      throw error;
    }

    const userHasConnection = userProfile.connections.some(
      (connection) => connection.toString() === targetUserId
    );
    const targetHasConnection = targetProfile.connections.some(
      (connection) => connection.toString() === userId
    );

    if (!userHasConnection || !targetHasConnection) {
      const error = new Error("Connection not found between the users");
      error.status = 400;
      throw error;
    }

    await UserProfile.updateOne(
      { userId },
      { $pull: { connections: targetUserId } }
    );
    await UserProfile.updateOne(
      { userId: targetUserId },
      { $pull: { connections: userId } }
    );

    res.status(200).json({ message: "Connection removed successfully" });
  } catch (error) {
    logger.error(`Error removing connection: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while removing the connection",
    });
  }
};

exports.getConnections = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const userProfile = await UserProfile.findOne({ userId })
      .select("connections")
      .populate({
        path: "connections",
        select: "email role",
        match: { isDeleted: false },
      })
      .lean();

    if (!userProfile) {
      const error = new Error("User profile not found");
      error.status = 404;
      throw error;
    }

    const connectionIds = userProfile.connections.map((connection) => connection._id);

    const connectionProfiles = await UserProfile.find({
      userId: { $in: connectionIds },
      isDeleted: false,
    })
      .select("userId fullName profilePicture")
      .lean();

    const paginatedConnections = userProfile.connections
      .slice((page - 1) * limit, page * limit)
      .map((connection) => {
        const profile = connectionProfiles.find(
          (p) => p.userId.toString() === connection._id.toString()
        );
        return {
          userId: connection._id,
          fullName: profile?.fullName || "Unnamed User",
          email: connection.email || "Not provided",
          role: connection.role || "Unknown",
          profilePicture: profile?.profilePicture || null,
        };
      });

    const total = userProfile.connections.length;

    res.status(200).json({
      message: "Connections retrieved successfully",
      connections: paginatedConnections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving connections: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving connections",
    });
  }
};

exports.getConnectionRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10, status = "pending" } = req.query;

    const userProfile = await UserProfile.findOne({ userId })
      .select("connectionRequests")
      .lean();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const filteredRequests = userProfile.connectionRequests.filter(
      (req) => req.status === status
    );

    const total = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice((page - 1) * limit, page * limit);

    const populatedRequests = await Promise.all(
      paginatedRequests.map(async (request) => {
        const fromUserProfile = await UserProfile.findOne({ userId: request.fromUserId })
          .select("fullName location.city")
          .populate("userId", "email role")
          .lean();
        return {
          fromUserId: request.fromUserId,
          fullName: fromUserProfile?.fullName || "Unnamed User",
          email: fromUserProfile?.userId?.email || "Not provided",
          role: fromUserProfile?.userId?.role || "Unknown",
          city: fromUserProfile?.location?.city || "Unknown",
          status: request.status,
        };
      })
    );

    res.status(200).json({
      message: "Connection requests retrieved successfully",
      connectionRequests: populatedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving connection requests: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving connection requests",
    });
  }
};

exports.getFollowedCompanies = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const userProfile = await UserProfile.findOne({ userId })
      .select("followedCompanies")
      .populate({
        path: "followedCompanies",
        select: "name industry location.city followers",
        match: { isDeleted: false },
      })
      .lean();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const total = userProfile.followedCompanies.length;
    const paginatedCompanies = userProfile.followedCompanies
      .slice((page - 1) * limit, page * limit)
      .map((company) => ({
        companyId: company._id,
        name: company.name || "Unnamed Company",
        industry: company.industry || "Unknown",
        city: company.location?.city || "Unknown",
        followerCount: company.followers ? company.followers.length : 0,
      }));

    res.status(200).json({
      message: "Followed companies retrieved successfully",
      companies: paginatedCompanies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`Error retrieving followed companies: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving followed companies",
    });
  }
};

exports.followCompany = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId } = req.params;

    const userProfile = await UserProfile.findOne({ userId })
      .select("followedCompanies")
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const company = await Company.findById(companyId);
    if (!company || company.isDeleted) {
      throw new Error("Company not found");
    }

    if (userProfile.followedCompanies.includes(companyId)) {
      throw new Error("You are already following this company");
    }

    await UserProfile.updateOne(
      { userId },
      { $push: { followedCompanies: companyId } }
    );
    await Company.updateOne(
      { _id: companyId },
      { $push: { followers: { userId } } }
    );

    res.status(200).json({ message: "Company followed successfully" });
  } catch (error) {
    logger.error(`Error following company: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while following the company",
    });
  }
};

exports.unfollowCompany = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId } = req.params;

    const userProfile = await UserProfile.findOne({ userId })
      .select("followedCompanies")
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    if (!userProfile.followedCompanies.includes(companyId)) {
      throw new Error("You are not following this company");
    }

    await UserProfile.updateOne(
      { userId },
      { $pull: { followedCompanies: companyId } }
    );
    await Company.updateOne(
      { _id: companyId },
      { $pull: { followers: { userId } } }
    );

    res.status(200).json({ message: "Company unfollowed successfully" });
  } catch (error) {
    logger.error(`Error unfollowing company: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while unfollowing the company",
    });
  }
};