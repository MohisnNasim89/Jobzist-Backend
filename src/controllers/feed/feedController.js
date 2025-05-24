const Post = require("../../models/post/Posts");
const Job = require("../../models/job/Job");
const UserProfile = require("../../models/user/UserProfile");
const logger = require("../../utils/logger");
const { checkUserIdMatch, renderProfileWithFallback } = require("../../utils/checks");

exports.getFeed = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only view your own feed");

    const userProfile = await UserProfile.findOne({ userId })
      .select("connections followedCompanies")
      .lean();
    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const connectionPosts = await Post.find({
      userId: { $in: userProfile.connections },
      visibility: "public",
      isDeleted: false,
    })
      .select("userId content likes comments visibility isDeleted createdAt tags")
      .populate("userId", "email role")
      .populate("tags.id", "name")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const publicPosts = await Post.find({
      userId: { $nin: userProfile.connections },
      visibility: "public",
      isDeleted: false,
    })
      .select("userId content likes comments visibility isDeleted createdAt tags")
      .populate("userId", "email role")
      .populate("tags.id", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const jobs = await Job.find({
      companyId: { $in: userProfile.followedCompanies },
      status: "Open",
      isDeleted: false,
    })
      .select("_id title companyId postedBy location jobType salary experienceLevel applicationDeadline status createdAt")
      .populate({ path: "companyId", select: "name logo", match: { isDeleted: false } })
      .populate({ path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const jobProfiles = jobs.map((job) => renderProfileWithFallback(job, "job", {
      _id: job._id,
      title: job.title,
      company: job.companyId ? { _id: job.companyId._id, name: job.companyId.name, logo: job.companyId.logo } : null,
      postedBy: job.postedBy?.profileId?.fullName || "Unknown",
      location: job.location,
      jobType: job.jobType,
      salary: job.salary,
      experienceLevel: job.experienceLevel,
      applicationDeadline: job.applicationDeadline,
      status: job.status,
      createdAt: job.createdAt,
    }));

    const feed = [
      ...connectionPosts.map((post) => ({ type: "post", content: post })),
      ...publicPosts.map((post) => ({ type: "post", content: post })),
      ...jobProfiles.map((job) => ({ type: "job", content: job })),
    ].sort((a, b) => new Date(b.content.createdAt) - new Date(a.content.createdAt));

    res.status(200).json({
      message: "Feed retrieved successfully",
      feed,
    });
  } catch (error) {
    logger.error(`Error retrieving feed: ${error.message}`);
    res.status(error.status || 500).json({
      message: error.message || "An error occurred while retrieving the feed",
    });
  }
};