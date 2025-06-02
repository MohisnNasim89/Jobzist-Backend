const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const fs = require("fs").promises;
const path = require("path");

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

logger.clearLogs = async () => {
  try {
    const logDir = path.join(__dirname, "..", "..", "logs");
    const files = await fs.readdir(logDir);

    for (const file of files) {
      if (file.startsWith("error-") || file.startsWith("combined-")) {
        const filePath = path.join(logDir, file);
        await fs.unlink(filePath);
        logger.info(`Cleared log file: ${file}`);
      }
    }
    logger.info("All logs cleared successfully");
  } catch (error) {
    logger.error(`Error clearing logs: ${error.message}`);
    throw error;
  }
};

module.exports = logger;