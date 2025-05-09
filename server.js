const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const connectDB = require("./src/config/database/mongo");
const upload = require("./src/config/multerConfig");
const errorMiddleware = require("./src/middlewares/errorMiddleware");
const { initSocket } = require("./src/socket/socket");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const userProfileRoutes = require("./src/routes/profile/userProfileRoutes");
const companyRoutes = require("./src/routes/profile/companyProfileRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");
const jobRoutes = require("./src/routes/job/jobRoutes");
const postRoutes = require("./src/routes/post/postRoutes");
const userRoutes = require("./src/routes/userConnection/connectionRoutes");
const notificationRoutes = require("./src/routes/notification/notificationRoutes");
const feedRoutes = require("./src/routes/feed/feedRoutes");
const searchRoutes = require("./src/routes/search/searchRoutes");
const recommendationRoutes = require("./src/routes/recommendation/recommendationRoutes");
const chatRoutes = require("./src/routes/chat/chatRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(helmet());

// Make the upload middleware available to routes
app.set("upload", upload);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userProfileRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/post", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/chats", chatRoutes);

// Root Route
app.get("/", (req, res) => {
  res.send("Jobzist Backend is Running 🚀");
});

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
});

// Error Middleware
app.use(errorMiddleware);

let server;
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    initSocket(server);
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

// Graceful Shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  try {
    await server.close();
    console.log("Server closed");

    const mongoose = require("mongoose");
    await mongoose.connection.close();
    console.log("MongoDB connection closed");

    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

module.exports = app;