const Post = require("../../models/post/Posts");
const {
  checkPostExists,
  checkPostOwnership,
  checkUserExists,
  checkUserOrCompanyExists,
} = require("../../utils/checks");

exports.createPost = async (req, res) => {
  const { userId } = req.user;
  const { content, visibility, tags } = req.body;

  await checkUserExists(userId);

  if (tags && tags.length > 0) {
    for (const tag of tags) {
      await checkUserOrCompanyExists(tag.type, tag.id);
    }
  }

  const post = new Post({
    userId,
    content: content || "",
    visibility: visibility || "public",
    tags: tags || [],
    media: { type: "none", url: null },
  });

  if (req.file) {
    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "video";
    post.media = {
      type: fileType,
      url: req.file.path, // Cloudinary URL
    };
  }

  await post.save();

  const populatedPost = await Post.findById(post._id)
    .populate("userId", "email role")
    .populate("tags.id", "name");

  return res.status(201).json({
    message: "Post created successfully",
    post: populatedPost,
  });
};

exports.getPost = async (req, res) => {
  const { postId } = req.params;

  const post = await checkPostExists(postId);

  return res.status(200).json({ post });
};

exports.getUserPosts = async (req, res) => {
  const { userId } = req.params;

  await checkUserExists(userId);

  const posts = await Post.find({ userId, isDeleted: false })
    .populate("userId", "email role")
    .populate("tags.id", "name")
    .sort({ createdAt: -1 });

  return res.status(200).json({ posts });
};

exports.updatePost = async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.user;
  const updates = req.body;

  const post = await checkPostExists(postId);
  checkPostOwnership(post, userId);

  if (updates.tags && updates.tags.length > 0) {
    for (const tag of updates.tags) {
      await checkUserOrCompanyExists(tag.type, tag.id);
    }
  }

  const allowedUpdates = ["content", "visibility", "tags"];
  Object.keys(updates).forEach((key) => {
    if (allowedUpdates.includes(key)) {
      post[key] = updates[key];
    }
  });

  if (req.file) {
    const fileType = req.file.mimetype.startsWith("image/") ? "image" : "video";
    post.media = {
      type: fileType,
      url: req.file.path, // Cloudinary URL
    };
  }

  await post.save();

  const populatedPost = await Post.findById(post._id)
    .populate("userId", "email role")
    .populate("tags.id", "name");

  return res.status(200).json({
    message: "Post updated successfully",
    post: populatedPost,
  });
};

exports.deletePost = async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const post = await checkPostExists(postId);
  checkPostOwnership(post, userId);

  await post.softDelete();

  return res.status(200).json({ message: "Post deleted successfully" });
};

exports.likePost = async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const post = await checkPostExists(postId);

  if (post.likes.includes(userId)) {
    post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
  } else {
    post.likes.push(userId);
  }

  await post.save();

  return res.status(200).json({
    message: post.likes.includes(userId) ? "Post liked" : "Post unliked",
    likes: post.likes.length,
  });
};

exports.commentOnPost = async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.user;
  const { content } = req.body;

  const post = await checkPostExists(postId);

  post.comments.push({
    userId,
    content,
    createdAt: new Date(),
  });

  await post.save();

  return res.status(200).json({
    message: "Comment added successfully",
    comment: post.comments[post.comments.length - 1],
  });
};

exports.sharePost = async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const post = await checkPostExists(postId);

  if (post.shares.includes(userId)) {
    throw new Error("You have already shared this post", { status: 400 });
  }

  post.shares.push(userId);
  await post.save();

  return res.status(200).json({
    message: "Post shared successfully",
    shares: post.shares.length,
  });
};

exports.savePost = async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.user;

  const post = await checkPostExists(postId);

  if (post.saves.includes(userId)) {
    post.saves = post.saves.filter((id) => id.toString() !== userId.toString());
  } else {
    post.saves.push(userId);
  }

  await post.save();

  return res.status(200).json({
    message: post.saves.includes(userId) ? "Post saved" : "Post unsaved",
    saves: post.saves.length,
  });
};