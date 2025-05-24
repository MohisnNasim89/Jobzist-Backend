const mongoose = require("mongoose");
const Chat = require("../../models/chat/Chat");
const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const logger = require("../../utils/logger");
const { checkUserExists } = require("../../utils/checks");
const { emitMessage, emitNotification } = require("../../socket/socket");
const { generateKey, encrypt, decrypt, encryptKey, decryptKey } = require("../../utils/encryption");
const Notification = require("../../models/notification/Notification");

exports.startChat = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    if (userId.toString() === targetUserId.toString()) {
      throw new Error("You cannot start a chat with yourself");
    }

    const user = await checkUserExists(userId);
    const targetUser = await checkUserExists(targetUserId);

    const userProfile = await UserProfile.findOne({ userId }).select("fullName").lean();
    const targetProfile = await UserProfile.findOne({ userId: targetUserId }).select("fullName").lean();

    if (!userProfile || !targetProfile) {
      throw new Error("User profile not found");
    }

    let chat = await Chat.findOne({
      "participants.userId": { $all: [userId, targetUserId] },
    }).select("participants messages encryptionKey").lean();

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

    const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
    const decryptedMessages = chat.messages.map((msg) => ({
      ...msg,
      message: decrypt(msg.encryptedMessage, decryptedEncryptionKey),
    }));

    res.status(200).json({ chat: { ...chat, messages: decryptedMessages } });
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
      throw new Error("Message must be a non-empty string");
    }

    const chat = await Chat.findOne({ _id: chatId });
    if (!chat) {
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
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

    const senderProfile = await UserProfile.findOne({ userId }).select("fullName").lean();
    const notification = new Notification({
      userId: otherParticipant.userId,
      type: "newMessage",
      relatedId: chatId,
      message: `New message from ${senderProfile.fullName}`,
      isRead: false,
    });
    await notification.save();

    emitNotification(otherParticipant.userId.toString(), notification);

    res.status(200).json({
      message: "Message sent successfully",
      newMessage: { ...newMessage, message: message.trim() },
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

    const chat = await Chat.findOne({ _id: chatId })
      .select("participants messages encryptionKey")
      .lean();
    if (!chat) {
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
    }

    const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
    const decryptedMessages = chat.messages.map((msg) => ({
      ...msg,
      message: decrypt(msg.encryptedMessage, decryptedEncryptionKey),
    }));

    res.status(200).json({ messages: decryptedMessages });
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
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
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

    const chats = await Chat.find({
      "participants.userId": userId,
    })
      .select("participants messages encryptionKey updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        const decryptedEncryptionKey = decryptKey(chat.encryptionKey);
        const latestMessage = chat.messages[chat.messages.length - 1];
        if (latestMessage) {
          const decryptedMessage = decrypt(latestMessage.encryptedMessage, decryptedEncryptionKey);
          return {
            ...chat,
            latestMessage: { ...latestMessage, message: decryptedMessage },
          };
        }
        return chat;
      })
    );

    res.status(200).json({ chats: enrichedChats });
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

    const chat = await Chat.findOne({ _id: chatId }).select("participants").lean();
    if (!chat) {
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
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
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
    }

    const messageIndex = chat.messages.findIndex(
      (msg) => msg.messageId.toString() === messageId
    );
    if (messageIndex === -1) {
      throw new Error("Message not found");
    }

    if (chat.messages[messageIndex].senderId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: You can only delete your own messages");
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
      throw new Error("New message must be a non-empty string");
    }

    const chat = await Chat.findOne({ _id: chatId }).select("participants messages encryptionKey");
    if (!chat) {
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
    }

    const messageIndex = chat.messages.findIndex(
      (msg) => msg.messageId.toString() === messageId
    );
    if (messageIndex === -1) {
      throw new Error("Message not found");
    }

    if (chat.messages[messageIndex].senderId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: You can only edit your own messages");
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
      newMessage: { encryptedMessage: encryptedNewMessage, sentAt: new Date() },
      action: "messageEdited",
    });

    res.status(200).json({ message: "Message edited successfully", newMessage: newMessage.trim() });
  } catch (error) {
    logger.error(`Error editing message: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while editing the message",
    });
  }
};