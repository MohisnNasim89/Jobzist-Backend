const express = require("express");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  getNotifications,
  markNotificationAsRead,
} = require("../../controllers/notification/notificationController");

const router = express.Router();

router.get("/:userId", verifyToken, getNotifications);
router.put("/:notificationId/read", verifyToken, markNotificationAsRead);

module.exports = router;