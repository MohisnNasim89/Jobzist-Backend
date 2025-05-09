const { Server } = require("socket.io");
const Notification = require("../models/notification/Notification");

const socketMap = new Map();
let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

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
  if (!io) {
    console.error("Socket.io not initialized. Call initSocket first.");
    return;
  }
  const socketId = socketMap.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit("notification", notification);
  }
};

const emitMessage = (userId, message) => {
  if (!io) {
    console.error("Socket.io not initialized. Call initSocket first.");
    return;
  }
  const socketId = socketMap.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit("message", message);
  }
};

module.exports = { initSocket, emitNotification, emitMessage };