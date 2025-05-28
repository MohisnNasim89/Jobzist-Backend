const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(`Error at ${req.path}: ${err.stack}`);

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid input data" });
  }

  if (err.name === "MongoError" && err.code === 11000) {
    return res.status(400).json({ message: "Duplicate entry detected" });
  }

  res.status(err.status || 500).json({ 
    message: err.status ? err.message : "Internal server error",
  });
};

module.exports = errorHandler;