const Notification = require("../../models/notification/Notification");
const { checkUserIdMatch } = require("../../utils/checks");

exports.getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only view your own notifications");

    const notifications = await Notification.find({ userId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      message: "Notifications retrieved successfully",
      notifications,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving notifications",
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({ _id: notificationId, userId, isDeleted: false });
    if (!notification) {
      throw new Error("Notification not found");
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while marking the notification as read",
    });
  }
};