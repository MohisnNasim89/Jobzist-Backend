const Post = require("../../models/post/Posts");
const Job = require("../../models/job/Job");
const UserProfile = require("../../models/user/UserProfile");
const logger = require("../../utils/logger");
const { checkUserIdMatch } = require("../../utils/checks");

exports.getFeed = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;
    const { page = 1, limit = 20 } = req.query;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only view your own feed");

    const userProfile = await UserProfile.findOne({ userId })
      .select("connections followedCompanies")
      .lean();
    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    const skip = (page - 1) * limit;
    const connectionPostsLimit = Math.floor(limit / 2); // Allocate half the limit to connection posts
    const publicPostsLimit = Math.floor(limit / 4); // Allocate a quarter to public posts
    const jobsLimit = Math.floor(limit / 4); // Allocate a quarter to jobs

    const connectionPosts = await Post.find({
      userId: { $in: userProfile.connections },
      visibility: "public",
      isDeleted: false,
    })
      .select("_id userId content likes comments createdAt")
      .populate({ path: "userId", select: "email role", match: { isDeleted: false } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(connectionPostsLimit)
      .lean();

    const publicPosts = await Post.find({
      userId: { $nin: userProfile.connections },
      visibility: "public",
      isDeleted: false,
    })
      .select("_id userId content likes comments createdAt")
      .populate({ path: "userId", select: "email role", match: { isDeleted: false } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(publicPostsLimit)
      .lean();

    const jobs = await Job.find({
      companyId: { $in: userProfile.followedCompanies },
      status: "Open",
      isDeleted: false,
    })
      .select("_id title companyId location jobType salary experienceLevel createdAt")
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(jobsLimit)
      .lean();

    const lightweightPosts = (posts) =>
      posts.map((post) => ({
        postId: post._id,
        userId: post.userId._id,
        email: post.userId.email,
        role: post.userId.role,
        content: post.content.length > 100 ? post.content.substring(0, 100) + "..." : post.content,
        likesCount: post.likes.length,
        commentsCount: post.comments.length,
        createdAt: post.createdAt,
      }));

    const lightweightJobs = (jobs) =>
      jobs.map((job) => ({
        jobId: job._id,
        title: job.title,
        company: job.companyId ? { companyId: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        experienceLevel: job.experienceLevel,
        createdAt: job.createdAt,
      }));

    const feed = [
      ...lightweightPosts(connectionPosts).map((post) => ({ type: "post", content: post })),
      ...lightweightPosts(publicPosts).map((post) => ({ type: "post", content: post })),
      ...lightweightJobs(jobs).map((job) => ({ type: "job", content: job })),
    ].sort((a, b) => new Date(b.content.createdAt) - new Date(a.content.createdAt));

    const totalConnectionPosts = await Post.countDocuments({
      userId: { $in: userProfile.connections },
      visibility: "public",
      isDeleted: false,
    });

    const totalPublicPosts = await Post.countDocuments({
      userId: { $nin: userProfile.connections },
      visibility: "public",
      isDeleted: false,
    });

    const totalJobs = await Job.countDocuments({
      companyId: { $in: userProfile.followedCompanies },
      status: "Open",
      isDeleted: false,
    });

    const totalItems = totalConnectionPosts + totalPublicPosts + totalJobs;

    res.status(200).json({
      message: "Feed retrieved successfully",
      feed: feed.slice(0, limit),
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalItems,
    });
  } catch (error) {
    logger.error(`Error retrieving feed: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the feed",
    });
  }
};