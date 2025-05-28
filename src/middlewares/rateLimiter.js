const rateLimit = require("express-rate-limit");

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Increased to 10 requests per 15 minutes
  keyGenerator: (req) => req.user?.userId || req.ip, // Use userId if authenticated, else IP
  message: { status: 429, message: "Too many AI requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user/IP to 100 requests per windowMs
  keyGenerator: (req) => req.user?.userId || req.ip, // Use userId if authenticated, else IP
  message: { status: 429, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalRateLimiter };