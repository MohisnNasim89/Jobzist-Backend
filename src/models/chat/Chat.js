const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const messageSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true,
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    sentAt: {
        type: Date,
        default: Date.now,
    },
});

const chatSchema = new mongoose.Schema(
    {
        participants: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                name: {
                    type: String,
                    required: true,
                },
            },
        ],
        messages: [messageSchema],
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

chatSchema.pre("save", function (next) {
    if (this.participants.length !== 2) {
        return next(new Error("Chat must have exactly two participants"));
    }
    const userIds = this.participants.map((p) => p.userId.toString());
    if (new Set(userIds).size !== userIds.length) {
        return next(new Error("Participants must be unique"));
    }
    next();
});

chatSchema.index({ "participants.userId": 1 });

applySoftDelete(chatSchema);

module.exports = mongoose.model("Chat", chatSchema);