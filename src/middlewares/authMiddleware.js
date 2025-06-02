const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
require("dotenv").config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token or invalid token format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ message: "Token expired" });
    }
    req.user = decoded;
    logger.info(`User authenticated: ${decoded.userId}`);
    next();
  } catch (error) {
    logger.warn(`Invalid token for user: ${token.slice(0, 10)}... - ${error.message}`);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { verifyToken };