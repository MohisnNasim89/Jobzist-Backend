const socketIo = require("socket.io");

let io;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join", (userId) => {
      socket.join(userId);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

const emitNotification = (userId, notification) => {
  if (io) {
    io.to(userId).emit("notification", notification);
  }
};

module.exports = { initSocket, emitNotification };