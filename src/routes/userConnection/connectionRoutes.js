const express = require("express");
const { verifyToken } = require("../../middlewares/authMiddleware");
const {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  removeConnection,
  followCompany,
  unfollowCompany,
} = require("../../controllers/userConnection/connectionController");

const router = express.Router();

router.post("/:targetUserId/connect", verifyToken, sendConnectionRequest);
router.post("/:requestUserId/accept", verifyToken, acceptConnectionRequest);
router.post("/:requestUserId/reject", verifyToken, rejectConnectionRequest);
router.delete("/:connectionId/remove", verifyToken, removeConnection);
router.post("/:companyId/follow", verifyToken, followCompany);
router.delete("/:companyId/unfollow", verifyToken, unfollowCompany);

module.exports = router;