// src/index.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const connectDB = require("./src/config/database/mongo");

const errorMiddleware = require("./src/middlewares/errorMiddleware");

const authRoutes = require("./src/routes/authRoutes");
const userRoutes = require("./src/routes/userRoutes");
const companyRoutes = require("./src/routes/companyRoutes");
const uploadRoutes = require("./src/routes/uploadRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(helmet());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/upload", uploadRoutes);

// Error Middleware
app.use(errorMiddleware);

// Root Route
app.get("/", (req, res) => {
  res.send("Jobzist Backend is Running 🚀");
});

// Connect to MongoDB and Start Server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.error("Failed to connect to MongoDB:", err));

module.exports = app; // Export for testing