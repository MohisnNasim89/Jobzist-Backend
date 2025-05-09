const express = require("express");
const router = express.Router();
const {
  startChat,
  sendMessage,
  getChatHistory,
  getUserChats,
  deleteChat,
  deleteMessage,
  editMessage,
} = require("../../controllers/chat/chatController");
const { verifyToken } = require("../../middlewares/authMiddleware");

router.get("/user", verifyToken, getUserChats);
router.get("/start/:targetUserId", verifyToken, startChat);
router.get("/:chatId", verifyToken, getChatHistory);
router.post("/:chatId/send", verifyToken, sendMessage);
router.delete("/:chatId", verifyToken, deleteChat);
router.delete("/:chatId/message/:messageId", verifyToken, deleteMessage);
router.put("/:chatId/message/:messageId", verifyToken, editMessage);

module.exports = router;