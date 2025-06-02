const Post = require("../../models/post/Posts");
const Notification = require("../../models/notification/Notification");
const UserProfile = require("../../models/user/UserProfile");
const cloudinary = require("cloudinary").v2;
const logger = require("../../utils/logger");
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
      tags: tags ? JSON.parse(tags) : [],
      media: [],
    });

    if (req.files && req.files.length > 0) {
      post.media = req.files.map((file) => {
        const fileType = file.mimetype.startsWith("image/") ? "image" : "video";
        return {
          type: fileType,
          url: file.path,
          publicId: file.publicId,
        };
      });
    }

    await post.save();

    if (post.visibility === "public") {
      const userProfile = await UserProfile.findOne({ userId })
        .select("fullName connections")
        .lean();
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

    return res.status(201).json({
      message: "Post created successfully",
      postId: post._id,
    });
  } catch (error) {
    logger.error(`Error creating post: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while creating the post",
    });
  }
};

exports.getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = req.user;

    const post = await Post.findById(postId)
      .select("userId content visibility tags media createdAt likes comments shares saves")
      .populate("userId", "email role")
      .populate("tags.id", "name")
      .lean();

    if (!post) {
      const error = new Error("Post not found");
      error.status = 404;
      throw error;
    }

    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    return res.status(200).json({
      message: "Post retrieved successfully",
      post: {
        postId: post._id,
        userId: post.userId,
        content: post.content,
        visibility: post.visibility,
        tags: post.tags,
        media: post.media,
        createdAt: post.createdAt,
        likes: post.likes.length,
        comments: post.comments,
        shares: post.shares.length,
        saves: post.saves.length,
      },
    });
  } catch (error) {
    logger.error(`Error retrieving post: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the post",
    });
  }
};

exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    await checkUserExists(userId);

    const query = { userId };
    if (userId.toString() !== authenticatedUserId.toString()) {
      query.visibility = "public";
    }

    const total = await Post.countDocuments(query);
    const posts = await Post.find(query)
      .select("userId content visibility tags media createdAt likes comments shares saves")
      .populate("userId", "email role")
      .populate("tags.id", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      message: "Posts retrieved successfully",
      posts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error(`Error retrieving user posts: ${error.message}`);
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

    if (req.files && req.files.length > 0) {
      const newMedia = req.files.map((file) => {
        const fileType = file.mimetype.startsWith("image/") ? "image" : "video";
        return {
          type: fileType,
          url: file.path,
          publicId: file.publicId,
        };
      });
      post.media = [...post.media, ...newMedia]; // Append new media to existing media array
    }

    await Post.findByIdAndUpdate(postId, post);

    return res.status(200).json({
      message: "Post updated successfully",
      postId: post._id,
    });
  } catch (error) {
    logger.error(`Error updating post: ${error.message}`);
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

    if (post.media && post.media.length > 0) {
      const publicIds = post.media.map((mediaItem) => {
        const folder = mediaItem.type === "image" ? "posts/images" : "posts/videos";
        return `${folder}/${mediaItem.publicId}`;
      });

      logger.info(`Public IDs to delete: ${JSON.stringify(publicIds)}`);

      for (const publicId of publicIds) {
        try {
          const resourceType = publicId.includes("posts/videos") ? "video" : "image";
          const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
          });
          logger.info(`Deleted media ${publicId} from Cloudinary: ${JSON.stringify(result)}`);
        } catch (cloudinaryError) {
          logger.error(`Failed to delete media ${publicId} from Cloudinary: ${cloudinaryError.message}`);
        }
      }
    }

    await Post.findByIdAndDelete(postId);

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting post: ${error.message}`);
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

    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    const isLiked = post.likes.includes(userId);
    const update = isLiked
      ? { $pull: { likes: userId } }
      : { $push: { likes: userId } };

    await Post.findByIdAndUpdate(postId, update);

    if (!isLiked && post.userId.toString() !== userId.toString()) {
      const userProfile = await UserProfile.findOne({ userId })
        .select("fullName")
        .lean();
      const notification = new Notification({
        userId: post.userId,
        type: "postInteraction",
        relatedId: post._id,
        message: `${userProfile.fullName} liked your post`,
      });
      await notification.save();
      emitNotification(post.userId.toString(), notification);
    }

    const updatedPost = await Post.findById(postId).select("likes");
    return res.status(200).json({
      message: isLiked ? "Post unliked" : "Post liked",
      likes: updatedPost.likes.length,
    });
  } catch (error) {
    logger.error(`Error liking/unliking post: ${error.message}`);
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

    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    await Post.findByIdAndUpdate(postId, {
      $push: { comments: { userId, content, createdAt: new Date() } },
    });

    if (post.userId.toString() !== userId.toString()) {
      const userProfile = await UserProfile.findOne({ userId })
        .select("fullName")
        .lean();
      const notification = new Notification({
        userId: post.userId,
        type: "postInteraction",
        relatedId: post._id,
        message: `${userProfile.fullName} commented on your post`,
      });
      await notification.save();
      emitNotification(post.userId.toString(), notification);
    }

    const updatedPost = await Post.findOne({ _id: postId, "comments.userId": userId })
      .select("comments")
      .lean();
    const comment = updatedPost.comments[updatedPost.comments.length - 1];

    return res.status(200).json({
      message: "Comment added successfully",
      comment: {
        commentId: comment._id,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    logger.error(`Error commenting on post: ${error.message}`);
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

    await Post.findByIdAndUpdate(postId, { $pull: { comments: { _id: commentId } } });

    return res.status(200).json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting comment: ${error.message}`);
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

    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    if (post.shares.includes(userId)) {
      throw new Error("You have already shared this post");
    }

    await Post.findByIdAndUpdate(postId, { $push: { shares: userId } });

    if (post.userId.toString() !== userId.toString()) {
      const userProfile = await UserProfile.findOne({ userId })
        .select("fullName")
        .lean();
      const notification = new Notification({
        userId: post.userId,
        type: "postInteraction",
        relatedId: post._id,
        message: `${userProfile.fullName} shared your post`,
      });
      await notification.save();
      emitNotification(post.userId.toString(), notification);
    }

    const updatedPost = await Post.findById(postId).select("shares");
    return res.status(200).json({
      message: "Post shared successfully",
      shares: updatedPost.shares.length,
    });
  } catch (error) {
    logger.error(`Error sharing post: ${error.message}`);
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

    if (post.visibility === "private" && post.userId.toString() !== userId.toString()) {
      throw new Error("Unauthorized: This post is private");
    }

    if (post.saves.includes(userId)) {
      await Post.findByIdAndUpdate(postId, { $pull: { saves: userId } });
    } else {
      await Post.findByIdAndUpdate(postId, { $push: { saves: userId } });
    }

    const updatedPost = await Post.findById(postId).select("saves");
    return res.status(200).json({
      message: updatedPost.saves.includes(userId) ? "Post saved" : "Post unsaved",
      saves: updatedPost.saves.length,
    });
  } catch (error) {
    logger.error(`Error saving/unsaving post: ${error.message}`);
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

    const newVisibility = post.visibility === "public" ? "private" : "public";
    await Post.findByIdAndUpdate(postId, { visibility: newVisibility });

    return res.status(200).json({
      message: `Post visibility toggled to ${newVisibility} successfully`,
      postId: post._id,
    });
  } catch (error) {
    logger.error(`Error toggling post visibility: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while toggling post visibility",
    });
  }
};