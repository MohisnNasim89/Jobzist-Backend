const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const { updateUserProfile, deleteUser } = require("../controllers/userController");

router.put("/profile", verifyToken, updateUserProfile);
router.delete("/account", verifyToken, deleteUser);

module.exports = router;