const mongoose = require("mongoose");
const Chat = require("../../models/chat/Chat");
const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const logger = require("../../utils/logger");
const { checkUserExists } = require("../../utils/checks");
const { emitMessage } = require("../../socket/socket");
const { generateKey, encrypt, decrypt, encryptKey, decryptKey } = require("../../utils/encryption");
const { sendNotification } = require("../../utils/notification");

exports.startChat = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ message: "You cannot start a chat with yourself" });
    }

    await checkUserExists(userId);
    await checkUserExists(targetUserId);

    const userProfile = await UserProfile.findOne({ userId, isDeleted: false }).select("fullName").lean();
    const targetProfile = await UserProfile.findOne({ userId: targetUserId, isDeleted: false }).select("fullName").lean();

    if (!userProfile || !targetProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    let chat = await Chat.findOne({
      "participants.userId": { $all: [userId, targetUserId] },
    }).select("_id").lean();

    if (!chat) {
      const rawEncryptionKey = generateKey();
      const encryptedEncryptionKey = encryptKey(rawEncryptionKey);
      chat = new Chat({
        participants: [
          { userId, name: userProfile.fullName },
          { userId: targetUserId, name: targetProfile.fullName },
        ],
        messages: [],
        encryptionKey: encryptedEncryptionKey,
      });
      await chat.save();
    }

    res.status(200).json({
      message: "Chat started successfully",
      chatId: chat._id,
    });
  } catch (error) {
    logger.error(`Error starting chat: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while starting the chat",
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ message: "Message must be a non-empty string" });
    }

    const chat = await Chat.findOne({ _id: chatId }).select("participants messages encryptionKey");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      return res.status(403).json({ message: "Unauthorized: You are not a participant in this chat" });
    }

    const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
    const encryptedMessage = encrypt(message.trim(), decryptedEncryptionKey);

    const newMessage = {
      messageId: new mongoose.Types.ObjectId(),
      senderId: userId,
      encryptedMessage,
      sentAt: new Date(),
      status: "sent",
    };

    chat.messages.push(newMessage);
    await chat.save();

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );
    emitMessage(otherParticipant.userId.toString(), {
      chatId,
      message: { ...newMessage, message: message.trim() },
      action: "newMessage",
    });

    newMessage.status = "delivered";
    chat.messages[chat.messages.length - 1].status = "delivered";
    await chat.save();

    const senderProfile = await UserProfile.findOne({ userId, isDeleted: false }).select("fullName").lean();
    await sendNotification({
      userId: otherParticipant.userId,
      type: "newMessage",
      relatedId: chatId,
      message: `New message from ${senderProfile.fullName}`,
    });

    res.status(200).json({
      message: "Message sent successfully",
      newMessage: {
        messageId: newMessage.messageId,
        message: message.trim(),
        sentAt: newMessage.sentAt,
        status: newMessage.status,
      },
    });
  } catch (error) {
    logger.error(`Error sending message: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while sending the message",
    });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const chat = await Chat.findOne({ _id: chatId })
      .select("participants messages encryptionKey")
      .lean();
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      return res.status(403).json({ message: "Unauthorized: You are not a participant in this chat" });
    }

    const startIndex = (page - 1) * limit;
    const paginatedMessages = chat.messages.slice(startIndex, startIndex + parseInt(limit));

    const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
    const messages = paginatedMessages.map((msg) => ({
      messageId: msg.messageId,
      senderId: msg.senderId,
      message: decrypt(msg.encryptedMessage, decryptedEncryptionKey),
      sentAt: msg.sentAt,
      status: msg.status,
      readAt: msg.readAt || null,
    }));

    res.status(200).json({
      message: "Chat history retrieved successfully",
      messages,
      page: parseInt(page),
      limit: parseInt(limit),
      total: chat.messages.length,
    });
  } catch (error) {
    logger.error(`Error retrieving chat history: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving chat history",
    });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId }).select("participants messages");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      return res.status(403).json({ message: "Unauthorized: You are not a participant in this chat" });
    }

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );

    let updated = false;
    chat.messages = chat.messages.map((msg) => {
      if (
        msg.senderId.toString() === otherParticipant.userId.toString() &&
        msg.status !== "read"
      ) {
        updated = true;
        return { ...msg.toObject(), status: "read", readAt: new Date() };
      }
      return msg;
    });

    if (updated) {
      await chat.save();
      emitMessage(otherParticipant.userId.toString(), {
        chatId,
        action: "messagesRead",
        messageIds: chat.messages
          .filter(
            (msg) =>
              msg.senderId.toString() === otherParticipant.userId.toString() &&
              msg.status === "read"
          )
          .map((msg) => msg.messageId.toString()),
      });
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    logger.error(`Error marking messages as read: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while marking messages as read",
    });
  }
};

exports.getUserChats = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const chats = await Chat.find({
      "participants.userId": userId,
    })
      .select("participants messages encryptionKey updatedAt")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalChats = await Chat.countDocuments({ "participants.userId": userId });

    const lightweightChats = await Promise.all(
      chats.map(async (chat) => {
        const otherParticipant = chat.participants.find(
          (p) => p.userId.toString() !== userId.toString()
        );
        const latestMessage = chat.messages[chat.messages.length - 1];

        let decryptedMessagePreview = null;
        if (latestMessage) {
          const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
          const fullMessage = decrypt(latestMessage.encryptedMessage, decryptedEncryptionKey);
          decryptedMessagePreview = fullMessage.length > 30 ? fullMessage.substring(0, 30) + "..." : fullMessage;
        }

        return {
          chatId: chat._id,
          otherParticipant: {
            userId: otherParticipant.userId,
            name: otherParticipant.name,
          },
          latestMessagePreview: decryptedMessagePreview || null,
          updatedAt: chat.updatedAt,
        };
      })
    );

    res.status(200).json({
      message: "User chats retrieved successfully",
      chats: lightweightChats,
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalChats,
    });
  } catch (error) {
    logger.error(`Error retrieving user chats: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving user chats",
    });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId }).select("participants");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      return res.status(403).json({ message: "Unauthorized: You are not a participant in this chat" });
    }

    await Chat.deleteOne({ _id: chatId });

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );
    emitMessage(otherParticipant.userId.toString(), {
      chatId,
      action: "chatDeleted",
    });

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting chat: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the chat",
    });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId, messageId } = req.params;

    const chat = await Chat.findOne({ _id: chatId }).select("participants messages");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      return res.status(403).json({ message: "Unauthorized: You are not a participant in this chat" });
    }

    const messageIndex = chat.messages.findIndex(
      (msg) => msg.messageId.toString() === messageId
    );
    if (messageIndex === -1) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (chat.messages[messageIndex].senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only delete your own messages" });
    }

    chat.messages.splice(messageIndex, 1);
    await chat.save();

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );
    emitMessage(otherParticipant.userId.toString(), {
      chatId,
      messageId,
      action: "messageDeleted",
    });

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting message: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the message",
    });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId, messageId } = req.params;
    const { newMessage } = req.body;

    if (!newMessage || typeof newMessage !== "string" || newMessage.trim() === "") {
      return res.status(400).json({ message: "New message must be a non-empty string" });
    }

    const chat = await Chat.findOne({ _id: chatId }).select("participants messages encryptionKey");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      return res.status(403).json({ message: "Unauthorized: You are not a participant in this chat" });
    }

    const messageIndex = chat.messages.findIndex(
      (msg) => msg.messageId.toString() === messageId
    );
    if (messageIndex === -1) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (chat.messages[messageIndex].senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized: You can only edit your own messages" });
    }

    const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
    const encryptedNewMessage = encrypt(newMessage.trim(), decryptedEncryptionKey);

    chat.messages[messageIndex].encryptedMessage = encryptedNewMessage;
    chat.messages[messageIndex].sentAt = new Date();
    await chat.save();

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );
    emitMessage(otherParticipant.userId.toString(), {
      chatId,
      messageId,
      newMessage: { message: newMessage.trim(), sentAt: new Date() },
      action: "messageEdited",
    });

    res.status(200).json({
      message: "Message edited successfully",
      newMessage: newMessage.trim(),
    });
  } catch (error) {
    logger.error(`Error editing message: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while editing the message",
    });
  }
};