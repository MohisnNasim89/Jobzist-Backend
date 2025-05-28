const express = require("express");
const { verifyToken } = require("../../middlewares/authMiddleware");
const connectionController = require("../../controllers/userConnection/connectionController");

const router = express.Router();

router.post("/:targetUserId/connect", verifyToken, connectionController.sendConnectionRequest);
router.post("/:requestUserId/accept", verifyToken, connectionController.acceptConnectionRequest);
router.post("/:requestUserId/reject", verifyToken, connectionController.rejectConnectionRequest);
router.delete("/:connectionId/remove", verifyToken, connectionController.removeConnection);
router.get("/connections", verifyToken, connectionController.getConnections);
router.get("/connection-requests", verifyToken, connectionController.getConnectionRequests);
router.get("/followed-companies", verifyToken, connectionController.getFollowedCompanies);
router.post("/:companyId/follow", verifyToken, connectionController.followCompany);
router.delete("/:companyId/unfollow", verifyToken, connectionController.unfollowCompany);

module.exports = router;