const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const logger = require("./src/utils/logger");
const connectDB = require("./src/config/database/mongo");
const upload = require("./src/config/multerConfig");
const errorMiddleware = require("./src/middlewares/errorMiddleware");
const { initSocket } = require("./src/socket/socket");
const {generalRateLimiter} = require("./src/middlewares/rateLimiter");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const userProfileRoutes = require("./src/routes/profile/userProfileRoutes");
const companyProfileRoutes = require("./src/routes/profile/companyProfileRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");
const jobRoutes = require("./src/routes/job/jobRoutes");
const postRoutes = require("./src/routes/post/postRoutes");
const userRoutes = require("./src/routes/userConnection/connectionRoutes");
const notificationRoutes = require("./src/routes/notification/notificationRoutes");
const feedRoutes = require("./src/routes/feed/feedRoutes");
const searchRoutes = require("./src/routes/search/searchRoutes");
const recommendationRoutes = require("./src/routes/recommendation/recommendationRoutes");
const chatRoutes = require("./src/routes/chat/chatRoutes");
const resumeRoutes = require("./src/routes/resume/resumeRoutes");
const companyAdminRoutes = require("./src/routes/companyAdmin/companyAdminRoutes");
const superAdminRoutes = require("./src/routes/superAdmin/superAdminRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(helmet());
// app.use(generalRateLimiter); 

app.set("upload", upload);

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userProfileRoutes);
app.use("/api/v1/company", companyProfileRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/job", jobRoutes);
app.use("/api/v1/post", postRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/feed", feedRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/v1/recommendations", recommendationRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/resume", resumeRoutes);
app.use("/api/v1/company-admin", companyAdminRoutes);
app.use("/api/v1/super-admin", superAdminRoutes);

// Root Route
app.get("/", (req, res) => {
  res.send("Jobzist Backend is Running 🚀");
});

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
});

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