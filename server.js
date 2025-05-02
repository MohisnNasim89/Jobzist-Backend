const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const connectDB = require("./src/config/database/mongo");
const upload = require("./src/config/multerConfig"); // Import Cloudinary-based multer config
const errorMiddleware = require("./src/middlewares/errorMiddleware");

// Routes
const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/profile/userProfileRoutes");
const companyRoutes = require("./src/routes/profile/companyProfileRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");
const jobRoutes = require("./src/routes/job/jobRoutes");
const postRoutes = require("./src/routes/post/postRoutes");

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
app.use("/api/user", userRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/job", jobRoutes);
app.use("/api/post", postRoutes);

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

// MongoDB Connection and Server Start
let server;
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1); // Exit if MongoDB connection fails
  });

// Graceful Shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("Server closed");
    const mongoose = require("mongoose");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

module.exports = app; // Export for testing