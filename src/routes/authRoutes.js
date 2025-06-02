const express = require("express");
const router = express.Router();
const { 
    register,
    login,
    oauthLogin,
    forgotPassword,
    logout } = require("../controllers/authController");
    
const {
    registerValidationRules,
    loginValidationRules,
    oauthValidationRules,
    forgotPasswordValidationRules, 
    validate } = require("../validations/authValidation");

const { verifyToken } = require("../middlewares/authMiddleware");

router.post("/register", registerValidationRules, validate, register);
router.post("/login", loginValidationRules, validate, login);
router.post("/oauth", oauthValidationRules, validate, oauthLogin);
router.post("/forgot-password", forgotPasswordValidationRules, validate, forgotPassword);
router.post("/logout", verifyToken, logout);

module.exports = router;