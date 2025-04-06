const express = require("express");
const router = express.Router();
const { register, login, oauthLogin, forgotPassword, logout, getCurrentUser } = require("../controllers/authController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/oauth", oauthLogin);
router.post("/forgot-password", forgotPassword);
router.post("/logout", verifyToken, logout);
router.get("/me", verifyToken, getCurrentUser);

module.exports = router;