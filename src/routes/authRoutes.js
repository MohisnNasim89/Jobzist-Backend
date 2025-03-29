const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/oauth", authController.oauthLogin);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);

module.exports = router;