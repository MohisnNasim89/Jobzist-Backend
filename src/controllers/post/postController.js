const Post = require("../../models/post/Posts");
const {
  checkPostExists,
  checkPostOwnership,
  checkUserExists,
  checkUserOrCompanyExists,
} = require("../../utils/checks");

exports.createPost = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while creating the post",
    });
  }
};

exports.getPost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await checkPostExists(postId);

    return res.status(200).json({ post });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the post",
    });
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    await checkUserExists(userId);

    const posts = await Post.find({ userId, isDeleted: false })
      .populate("userId", "email role")
      .populate("tags.id", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ posts });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving user posts",
    });
  }
};

exports.updatePost = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while updating the post",
    });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.user;

    const post = await checkPostExists(postId);
    checkPostOwnership(post, userId);

    await post.softDelete();

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the post",
    });
  }
};

exports.likePost = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while liking/unliking the post",
    });
  }
};

exports.commentOnPost = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while commenting on the post",
    });
  }
};

exports.sharePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.user;

    const post = await checkPostExists(postId);

    if (post.shares.includes(userId)) {
      throw new Error("You have already shared this post");
    }

    post.shares.push(userId);
    await post.save();

    return res.status(200).json({
      message: "Post shared successfully",
      shares: post.shares.length,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while sharing the post",
    });
  }
};

exports.savePost = async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while saving/unsaving the post",
    });
  }
};