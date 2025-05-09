const Chat = require("../../models/chat/Chat");
const User = require("../../models/user/Users");
const UserProfile = require("../../models/user/UserProfile");
const { checkUserExists } = require("../../utils/checks");
const { emitMessage } = require("../../socket/socket");

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
      chat = new Chat({
        participants: [
          { userId, name: userProfile.fullName },
          { userId: targetUserId, name: targetProfile.fullName },
        ],
        messages: [],
      });
      await chat.save();
    }

    res.status(200).json({ chat });
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

    const newMessage = {
      senderId: userId,
      message: message.trim(),
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

    res.status(200).json({ message: "Message sent successfully", newMessage });
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

    res.status(200).json({ messages: chat.messages });
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

    res.status(200).json({ chats });
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

    chat.messages[messageIndex].message = newMessage.trim();
    chat.messages[messageIndex].sentAt = new Date();
    await chat.save();

    const otherParticipant = chat.participants.find(
      (p) => p.userId.toString() !== userId.toString()
    );
    emitMessage(otherParticipant.userId.toString(), {
      chatId,
      messageId,
      newMessage: newMessage.trim(),
      action: "messageEdited",
    });

    res.status(200).json({ message: "Message edited successfully", newMessage: newMessage.trim() });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while editing the message",
    });
  }
};