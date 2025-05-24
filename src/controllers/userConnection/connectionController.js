const UserProfile = require("../../models/user/UserProfile");
const Notification = require("../../models/notification/Notification");
const { checkUserExists } = require("../../utils/checks");
const { emitNotification } = require("../../socket/socket");
const logger = require("../utils/logger");

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