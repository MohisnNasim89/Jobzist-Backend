const Notification = require("../../models/notification/Notification");
const logger = require("../../utils/logger");
const { checkUserIdMatch } = require("../../utils/checks");

exports.getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;
    const { page = 1, limit = 50 } = req.query;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only view your own notifications");

    const total = await Notification.countDocuments({ userId, isDeleted: false });
    const notifications = await Notification.find({ userId, isDeleted: false })
      .select("_id userId type message createdAt isRead")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      message: "Notifications retrieved successfully",
      notifications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error retrieving notifications: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving notifications",
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({ _id: notificationId, userId, isDeleted: false })
      .select("_id userId isRead isDeleted")
      .lean();
    if (!notification) {
      throw new Error("Notification not found");
    }

    await Notification.findByIdAndUpdate(notificationId, { isRead: true });

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    logger.error(`Error marking notification as read: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while marking the notification as read",
    });
  }
};