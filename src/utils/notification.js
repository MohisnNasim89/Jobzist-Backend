const Notification = require("../models/notification/Notification");
const { emitNotification } = require("../socket");
const logger = require("./logger");

const sendNotification = async ({ userId, type, relatedId, message }) => {
  try {
    const notification = new Notification({
      userId,
      type,
      relatedId,
      message,
    });
    await notification.save();
    try {
      emitNotification(userId, notification);
    } catch (socketError) {
      logger.warn(`Socket notification failed for user ${userId}: ${socketError.message}`);
    }
  } catch (error) {
    logger.error(`Failed to send notification to user ${userId}: ${error.message}`);
    throw error;
  }
};

const sendNotificationsToUsers = async ({ userIds, type, relatedId, message }) => {
  const BATCH_SIZE = 100;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(userId =>
      sendNotification({ userId, type, relatedId, message }).catch(err => {
        logger.warn(`Notification failed for user ${userId}: ${err.message}`);
      })
    );
    await Promise.all(promises);
  }
};

module.exports = { sendNotification, sendNotificationsToUsers };