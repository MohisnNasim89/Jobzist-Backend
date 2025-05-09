const { Server } = require("socket.io");
const Notification = require("../models/notification/Notification");

const socketMap = new Map();

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) {
      socketMap.set(userId, socket.id);
      console.log(`User ${userId} connected with socket ID ${socket.id}`);

      socket.on("disconnect", () => {
        socketMap.delete(userId);
        console.log(`User ${userId} disconnected`);
      });
    }
  });
};

const emitNotification = (userId, notification) => {
  const socketId = socketMap.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit("notification", notification);
  }
};

const emitMessage = (userId, message) => {
  const socketId = socketMap.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit("message", message);
  }
};

module.exports = { setupSocket, emitNotification, emitMessage };