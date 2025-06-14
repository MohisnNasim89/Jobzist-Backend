const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { 
    type: String, 
    enum: ["newPost", "newJob", "applicationUpdate", "postInteraction", "connectionRequest", "newMessage", "jobOffer", "employerApprovalRequest", "employerApproval"], 
    required: true 
  },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

applySoftDelete(notificationSchema);

module.exports = mongoose.model("Notification", notificationSchema);