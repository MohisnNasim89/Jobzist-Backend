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
} = require("../controllers/chat/chatController");
const { authenticateToken } = require("../middlewares/authMiddleware");

router.get("/user", authenticateToken, getUserChats);
router.get("/start/:targetUserId", authenticateToken, startChat);
router.get("/:chatId", authenticateToken, getChatHistory);
router.post("/:chatId/send", authenticateToken, sendMessage);
router.delete("/:chatId", authenticateToken, deleteChat);
router.delete("/:chatId/message/:messageId", authenticateToken, deleteMessage);
router.put("/:chatId/message/:messageId", authenticateToken, editMessage);

module.exports = router;