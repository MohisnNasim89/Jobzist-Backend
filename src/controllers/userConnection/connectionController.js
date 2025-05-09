const UserProfile = require("../../models/user/UserProfile");
const Notification = require("../../models/notification/Notification");
const { checkUserExists, checkUserIdMatch } = require("../../utils/checks");
const { emitNotification } = require("../../socket/socket");

exports.sendConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    if (userId.toString() === targetUserId.toString()) {
      throw new Error("You cannot send a connection request to yourself");
    }

    const user = await checkUserExists(userId);
    const targetUser = await checkUserExists(targetUserId);

    const userProfile = await UserProfile.findOne({ userId });
    const targetProfile = await UserProfile.findOne({ userId: targetUserId });

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
      mutualRequest.status = "accepted";
      userProfile.connections.push(targetUserId);
      targetProfile.connections.push(userId);
      await userProfile.save();
      await targetProfile.save();

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

    targetProfile.connectionRequests.push({ fromUserId: userId });
    await targetProfile.save();

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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while sending the connection request",
    });
  }
};

exports.acceptConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { requestUserId } = req.params;

    const userProfile = await UserProfile.findOne({ userId });
    const requesterProfile = await UserProfile.findOne({ userId: requestUserId });

    if (!userProfile || !requesterProfile) {
      throw new Error("User profile not found");
    }

    const requestIndex = userProfile.connectionRequests.findIndex(
      (req) => req.fromUserId.toString() === requestUserId.toString() && req.status === "pending"
    );
    if (requestIndex === -1) {
      throw new Error("No pending connection request found");
    }

    userProfile.connectionRequests[requestIndex].status = "accepted";
    userProfile.connections.push(requestUserId);
    requesterProfile.connections.push(userId);
    await userProfile.save();
    await requesterProfile.save();

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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while accepting the connection request",
    });
  }
};

exports.rejectConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { requestUserId } = req.params;

    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const requestIndex = userProfile.connectionRequests.findIndex(
      (req) => req.fromUserId.toString() === requestUserId.toString() && req.status === "pending"
    );
    if (requestIndex === -1) {
      throw new Error("No pending connection request found");
    }

    userProfile.connectionRequests[requestIndex].status = "rejected";
    await userProfile.save();

    res.status(200).json({ message: "Connection request rejected successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while rejecting the connection request",
    });
  }
};

exports.removeConnection = async (req, res) => {
  try {
    const { userId } = req.user;
    const { connectionId } = req.params;

    const userProfile = await UserProfile.findOne({ userId });
    const connectionProfile = await UserProfile.findOne({ userId: connectionId });

    if (!userProfile || !connectionProfile) {
      throw new Error("User profile not found");
    }

    userProfile.connections = userProfile.connections.filter(
      (id) => id.toString() !== connectionId.toString()
    );
    connectionProfile.connections = connectionProfile.connections.filter(
      (id) => id.toString() !== userId.toString()
    );

    await userProfile.save();
    await connectionProfile.save();

    res.status(200).json({ message: "Connection removed successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while removing the connection",
    });
  }
};

exports.followCompany = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId } = req.params;

    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    if (userProfile.followedCompanies.includes(companyId)) {
      throw new Error("You are already following this company");
    }

    userProfile.followedCompanies.push(companyId);
    await userProfile.save();

    res.status(200).json({ message: "Company followed successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while following the company",
    });
  }
};

exports.unfollowCompany = async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyId } = req.params;

    const userProfile = await UserProfile.findOne({ userId });
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    userProfile.followedCompanies = userProfile.followedCompanies.filter(
      (id) => id.toString() !== companyId.toString()
    );
    await userProfile.save();

    res.status(200).json({ message: "Company unfollowed successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while unfollowing the company",
    });
  }
};