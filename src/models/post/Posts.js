const mongoose = require("mongoose");

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

const mediaSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "video"], required: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
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
    media: [mediaSchema],
    tags: [tagSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);