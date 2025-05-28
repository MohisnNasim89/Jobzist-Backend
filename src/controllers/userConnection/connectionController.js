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
      throw new Error("You cannot send a connection request to yourself");
    }

    const user = await checkUserExists(userId);
    const targetUser = await checkUserExists(targetUserId);

    const userProfile = await UserProfile.findOne({ userId })
      .select("connections connectionRequests fullName")
      .lean();
    const targetProfile = await UserProfile.findOne({ userId: targetUserId })
      .select("connections connectionRequests fullName")
      .lean();

    if (!userProfile || !targetProfile) {
      throw new Error("User profile not found");
    }

    if (userProfile.connections.includes(targetUserId)) {
      throw new Error("You are already connected with this user");
    }

    const mutualRequest = userProfile.connectionRequests.find(
      (req) => req.fromUserId.toString() === targetUserId.toString() && req.status === "pending"
    );

    if (mutualRequest) {
      await UserProfile.updateOne(
        { userId },
        {
          $push: { connections: targetUserId },
          $set: { "connectionRequests.$[req].status": "accepted" }
        },
        { arrayFilters: [{ "req.fromUserId": targetUserId }] }
      );
      await UserProfile.updateOne({ userId: targetUserId }, { $push: { connections: userId } });

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
      throw new Error("Connection request already sent");
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
      .select("connectionRequests fullName")
      .lean();
    const requesterProfile = await UserProfile.findOne({ userId: requestUserId })
      .select("fullName")
      .lean();

    if (!userProfile || !requesterProfile) {
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
      {
        $push: { connections: requestUserId },
        $set: { "connectionRequests.$[req].status": "accepted" }
      },
      { arrayFilters: [{ "req.fromUserId": requestUserId }] }
    );
    await UserProfile.updateOne({ userId: requestUserId }, { $push: { connections: userId } });

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
    const { connectionId } = req.params;

    const userProfile = await UserProfile.findOne({ userId }).select("connections").lean();
    const connectionProfile = await UserProfile.findOne({ userId: connectionId })
      .select("connections")
      .lean();

    if (!userProfile || !connectionProfile) {
      throw new Error("User profile not found");
    }

    await UserProfile.updateOne(
      { userId },
      { $pull: { connections: connectionId } }
    );
    await UserProfile.updateOne(
      { userId: connectionId },
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
        select: "userId fullName location.city",
        populate: { path: "userId", select: "email role" },
        match: { isDeleted: false }
      })
      .lean();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const total = userProfile.connections.length;
    const paginatedConnections = userProfile.connections
      .slice((page - 1) * limit, page * limit)
      .map(connection => ({
        userId: connection.userId._id,
        fullName: connection.fullName || "Unnamed User",
        email: connection.userId.email || "Not provided",
        role: connection.userId.role || "Unknown",
        city: connection.location?.city || "Unknown",
      }));

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
      req => req.status === status
    );

    const total = filteredRequests.length;
    const paginatedRequests = filteredRequests
      .slice((page - 1) * limit, page * limit);

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
        select: "name industry location.city",
        match: { isDeleted: false }
      })
      .lean();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const total = userProfile.followedCompanies.length;
    const paginatedCompanies = userProfile.followedCompanies
      .slice((page - 1) * limit, page * limit)
      .map(company => ({
        companyId: company._id,
        name: company.name || "Unnamed Company",
        industry: company.industry || "Unknown",
        city: company.location?.city || "Unknown",
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
      .lean();
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      throw new Error("Company not found");
    }

    if (userProfile.followedCompanies.includes(companyId)) {
      throw new Error("You are already following this company");
    }

    await UserProfile.updateOne({ userId }, { $push: { followedCompanies: companyId } });

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
      .lean();
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    await UserProfile.updateOne(
      { userId },
      { $pull: { followedCompanies: companyId } }
    );

    res.status(200).json({ message: "Company unfollowed successfully" });
  } catch (error) {
    logger.error(`Error unfollowing company: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while unfollowing the company",
    });
  }
};