const Post = require("../../models/post/Posts");
const Notification = require("../../models/notification/Notification");
const UserProfile = require("../../models/user/UserProfile");
const {
  checkPostExists,
  checkPostOwnership,
  checkUserExists,
  checkUserOrCompanyExists,
} = require("../../utils/checks");
const { emitNotification } = require("../../socket/socket");

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

    if (post.visibility === "public") {
      const userProfile = await UserProfile.findOne({ userId });
      if (userProfile && userProfile.connections.length > 0) {
        const notifications = userProfile.connections.map((connectionId) => ({
          userId: connectionId,
          type: "newPost",
          relatedId: post._id,
          message: `${userProfile.fullName} has created a new post`,
          createdAt: new Date(),
        }));
        await Notification.insertMany(notifications);
        notifications.forEach((notification) => {
          emitNotification(notification.userId.toString(), notification);
        });
      }
    }

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
    const { userId } = req.user;

    const post = await checkPostExists(postId);

    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

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
    const authenticatedUserId = req.user.userId;

    await checkUserExists(userId);

    const query = { userId, isDeleted: false };
    if (userId.toString() !== authenticatedUserId.toString()) {
      query.visibility = "public";
    }

    const posts = await Post.find(query)
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

    // Check visibility
    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    const isLiked = post.likes.includes(userId);
    if (isLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
    } else {
      post.likes.push(userId);
    }

    await post.save();

    if (!isLiked && post.userId.toString() !== userId.toString()) {
      const userProfile = await UserProfile.findOne({ userId });
      const notification = new Notification({
        userId: post.userId,
        type: "postInteraction",
        relatedId: post._id,
        message: `${userProfile.fullName} liked your post`,
      });
      await notification.save();
      emitNotification(post.userId.toString(), notification);
    }

    return res.status(200).json({
      message: isLiked ? "Post unliked" : "Post liked",
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

    // Check visibility
    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    post.comments.push({
      userId,
      content,
      createdAt: new Date(),
    });

    await post.save();

    if (post.userId.toString() !== userId.toString()) {
      const userProfile = await UserProfile.findOne({ userId });
      const notification = new Notification({
        userId: post.userId,
        type: "postInteraction",
        relatedId: post._id,
        message: `${userProfile.fullName} commented on your post`,
      });
      await notification.save();
      emitNotification(post.userId.toString(), notification);
    }

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

exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { userId } = req.user;

    const post = await checkPostExists(postId);

    // Check visibility
    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    const commentIndex = post.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );
    if (commentIndex === -1) {
      const error = new Error("Comment not found");
      error.status = 404;
      throw error;
    }

    const comment = post.comments[commentIndex];
    if (comment.userId.toString() !== userId.toString()) {
      const error = new Error("Unauthorized: You can only delete your own comments");
      error.status = 403;
      throw error;
    }

    post.comments.splice(commentIndex, 1);
    await post.save();

    return res.status(200).json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while deleting the comment",
    });
  }
};

exports.sharePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.user;

    const post = await checkPostExists(postId);

    // Check visibility
    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    if (post.shares.includes(userId)) {
      throw new Error("You have already shared this post");
    }

    post.shares.push(userId);
    await post.save();

    if (post.userId.toString() !== userId.toString()) {
      const userProfile = await UserProfile.findOne({ userId });
      const notification = new Notification({
        userId: post.userId,
        type: "postInteraction",
        relatedId: post._id,
        message: `${userProfile.fullName} shared your post`,
      });
      await notification.save();
      emitNotification(post.userId.toString(), notification);
    }

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

    // Check visibility
    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

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

exports.togglePostVisibility = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.user;

    const post = await checkPostExists(postId);
    checkPostOwnership(post, userId);

    // Toggle visibility between "private" and "public"
    const newVisibility = post.visibility === "public" ? "private" : "public";
    post.visibility = newVisibility;
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate("userId", "email role")
      .populate("tags.id", "name");

    return res.status(200).json({
      message: `Post visibility toggled to ${newVisibility} successfully`,
      post: populatedPost,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while toggling post visibility",
    });
  }
};