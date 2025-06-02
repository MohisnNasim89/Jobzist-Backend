const rateLimit = require("express-rate-limit");

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10,
  keyGenerator: (req) => req.user?.userId || req.ip, 
  message: { status: 429, message: "Too many AI requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 100,
  keyGenerator: (req) => req.user?.userId || req.ip, 
  message: { status: 429, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { aiRateLimiter, generalRateLimiter };