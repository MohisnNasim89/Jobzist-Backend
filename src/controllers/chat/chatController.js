const Chat = require("../../models/chat/Chat");
const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const { checkUserExists } = require("../../utils/checks");
const { emitMessage, emitNotification } = require("../../socket/socket");
const CryptoJS = require("crypto-js");
const Notification = require("../../models/notification/Notification");

const generateEncryptionKey = () => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encryptedMessage, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

exports.startChat = async (req, res) => {
  try {
    const { userId } = req.user;
    const { targetUserId } = req.params;

    if (userId.toString() === targetUserId.toString()) {
      throw new Error("You cannot start a chat with yourself");
    }

    const user = await checkUserExists(userId);
    const targetUser = await checkUserExists(targetUserId);

    const userProfile = await UserProfile.findOne({ userId });
    const targetProfile = await UserProfile.findOne({ userId: targetUserId });

    if (!userProfile || !targetProfile) {
      throw new Error("User profile not found");
    }

    let chat = await Chat.findOne({
      "participants.userId": { $all: [userId, targetUserId] },
    });

    if (!chat) {
      const encryptionKey = generateEncryptionKey();
      chat = new Chat({
        participants: [
          { userId, name: userProfile.fullName },
          { userId: targetUserId, name: targetProfile.fullName },
        ],
        messages: [],
        encryptionKey,
      });
      await chat.save();
    }

    const decryptedMessages = chat.messages.map((msg) =>
      decryptMessage(msg.encryptedMessage, chat.encryptionKey)
    );

    res.status(200).json({ chat: { ...chat.toObject(), messages: decryptedMessages } });
  } catch (error) {
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

    const encryptedMessage = encryptMessage(message.trim(), chat.encryptionKey);

    const newMessage = {
      senderId: userId,
      encryptedMessage,
      sentAt: new Date(),
    };

    chat.messages.push(newMessage);
    await chat.save();

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );
    emitMessage(otherParticipant.userId.toString(), {
      chatId,
      message: newMessage,
    });
    
    const senderProfile = await UserProfile.findOne({ userId });
    const notification = new Notification({
      userId: otherParticipant.userId,
      type: "newMessage",
      relatedId: chatId,
      message: `New message from ${senderProfile.fullName}`,
      isRead: false,
    });
    await notification.save();

    // Emit real-time notification to the receiver
    emitNotification(otherParticipant.userId.toString(), notification);

    res.status(200).json({ message: "Message sent successfully", newMessage: { ...newMessage, message: message.trim() } });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while sending the message",
    });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId });
    if (!chat) {
      throw new Error("Chat not found");
    }

    if (!chat.participants.some((p) => p.userId.toString() === userId.toString())) {
      throw new Error("Unauthorized: You are not a participant in this chat");
    }

    const decryptedMessages = chat.messages.map((msg) =>
      ({ ...msg.toObject(), message: decryptMessage(msg.encryptedMessage, chat.encryptionKey) })
    );

    res.status(200).json({ messages: decryptedMessages });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving chat history",
    });
  }
};

exports.getUserChats = async (req, res) => {
  try {
    const { userId } = req.user;

    const chats = await Chat.find({
      "participants.userId": userId,
    }).sort({ updatedAt: -1 });

    const enrichedChats = await Promise.all(chats.map(async (chat) => {
      const latestMessage = chat.messages[chat.messages.length - 1];
      if (latestMessage) {
        const decryptedMessage = decryptMessage(latestMessage.encryptedMessage, chat.encryptionKey);
        return { ...chat.toObject(), latestMessage: { ...latestMessage.toObject(), message: decryptedMessage } };
      }
      return chat.toObject();
    }));

    res.status(200).json({ chats: enrichedChats });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving user chats",
    });
  }
};

exports.deleteChat = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId } = req.params;

    const chat = await Chat.findOne({ _id: chatId });
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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the chat",
    });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { userId } = req.user;
    const { chatId, messageId } = req.params;

    const chat = await Chat.findOne({ _id: chatId });
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

    const chat = await Chat.findOne({ _id: chatId });
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

    const encryptedNewMessage = encryptMessage(newMessage.trim(), chat.encryptionKey);

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
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while editing the message",
    });
  }
};