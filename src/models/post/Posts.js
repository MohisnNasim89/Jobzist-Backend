const mongoose = require("mongoose");
const { applySoftDelete } = require("../../utils/softDelete");

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const tagSchema = new mongoose.Schema({
  type: { type: String, enum: ["User", "Company"], required: true },
  id: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "tags.type" },
});

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    media: {
      type: {
        type: String,
        enum: ["image", "video", "none"],
        default: "none",
      },
      url: { type: String, default: null },
    },
    tags: [tagSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    visibility: {
      type: String,
      enum: ["public", "connections", "private"],
      default: "public",
    },
  },
  { timestamps: true }
);

applySoftDelete(postSchema);

module.exports = mongoose.model("Post", postSchema);