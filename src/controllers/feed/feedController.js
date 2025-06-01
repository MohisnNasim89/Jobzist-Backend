const Post = require("../../models/post/Posts");
const Job = require("../../models/job/Job");
const UserProfile = require("../../models/user/UserProfile");
const Company = require("../../models/company/Company"); // Assuming a Company model exists
const logger = require("../../utils/logger");
const { checkUserIdMatch } = require("../../utils/checks");

exports.getFeed = async (req, res) => {
  try {
    const { userId } = req.params;
    const { userId: authenticatedUserId } = req.user;
    const { page = 1, limit = 20 } = req.query;

    checkUserIdMatch(userId, authenticatedUserId, "Unauthorized: You can only view your own feed");

    const userProfile = await UserProfile.findOne({ userId })
      .select("connections followedCompanies role");
    if (!userProfile) {
      return res.status(404).json({ message: "User profile not found" });
    }

    const skip = (page - 1) * limit;
    const baseLimit = Math.max(1, Math.floor(limit * 0.6)); // 60% for base feed
    const recommendationLimit = Math.max(1, Math.floor(limit * 0.4)); // 40% for recommendations
    const connectionPostsLimit = Math.max(1, Math.floor(baseLimit * 0.5 / 2)); // Half of base for connections
    const publicPostsLimit = Math.max(1, Math.floor(baseLimit * 0.25 / 2)); // Quarter of base for public
    const followedCompaniesPostsLimit = Math.max(1, Math.floor(baseLimit * 0.25 / 2)); // Quarter for followed companies posts
    const jobsLimit = Math.max(1, Math.floor(baseLimit * 0.25)); // Quarter for jobs
    const companyRecLimit = Math.max(1, Math.floor(recommendationLimit * 0.5)); // Half for company recommendations
    const jobseekerRecLimit = Math.max(1, Math.floor(recommendationLimit * 0.5)); // Half for jobseeker recommendations

    // Base Feed Items
    const connectionPosts = await Post.find({
      userId: { $in: userProfile.connections },
      visibility: "public",
    })
      .select("_id userId content likes comments media createdAt")
      .populate({ path: "userId", select: "email role" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(connectionPostsLimit)
      .lean();

    const publicPosts = await Post.find({
      userId: { $nin: userProfile.connections },
      visibility: "public",
    })
      .select("_id userId content likes comments media createdAt")
      .populate({ path: "userId", select: "email role" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(publicPostsLimit)
      .lean();

    const followedCompaniesPosts = await Post.find({
      userId: { $in: await UserProfile.distinct("userId", { companyId: { $in: userProfile.followedCompanies } }) },
      visibility: "public",
    })
      .select("_id userId content likes comments media createdAt")
      .populate({ path: "userId", select: "email role" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(followedCompaniesPostsLimit)
      .lean();

    const jobs = await Job.find({
      companyId: { $in: userProfile.followedCompanies },
      status: "Open",
    })
      .select("_id title companyId location jobType salary experienceLevel createdAt")
      .populate({ path: "companyId", select: "name logo" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(jobsLimit)
      .lean();

    // Recommendations
    const randomCompanies = await Company.aggregate([
      { $match: { _id: { $nin: userProfile.followedCompanies }, isDeleted: false } },
      { $sample: { size: companyRecLimit } },
      { $project: { name: 1, logo: 1 } },
    ]);

    const jobseekerPosts = await Post.find({
      userId: {
        $nin: [...userProfile.connections, ...(await UserProfile.distinct("userId", { companyId: { $in: userProfile.followedCompanies } }))],
      },
      visibility: "public",
      "userId.role": "Jobseeker",
    })
      .select("_id userId content likes comments media createdAt")
      .populate({ path: "userId", select: "email role" })
      .sort({ createdAt: -1 })
      .limit(jobseekerRecLimit)
      .lean();

    const lightweightPosts = (posts) =>
      posts
        .filter((post) => post.userId)
        .map((post) => ({
          postId: post._id,
          userId: post.userId._id,
          email: post.userId.email || "Unknown",
          role: post.userId.role || "Unknown",
          content: post.content.length > 100 ? post.content.substring(0, 100) + "..." : post.content,
          media: post.media || [],
          likesCount: post.likes.length,
          commentsCount: post.comments.length,
          createdAt: post.createdAt,
        }));

    const lightweightJobs = (jobs) =>
      jobs.map((job) => ({
        jobId: job._id,
        title: job.title,
        company: job.companyId ? { companyId: job.companyId._id, name: job.companyId.name || "Unknown", logo: job.companyId.logo } : null,
        location: job.location,
        jobType: job.jobType,
        salary: job.salary,
        experienceLevel: job.experienceLevel,
        createdAt: job.createdAt,
      }));

    const lightweightCompanies = (companies) =>
      companies.map((company) => ({
        companyId: company._id,
        name: company.name || "Unknown",
        logo: company.logo,
      }));

    const allItems = [
      ...lightweightPosts(connectionPosts).map((post) => ({ type: "post", content: post })),
      ...lightweightPosts(publicPosts).map((post) => ({ type: "post", content: post })),
      ...lightweightPosts(followedCompaniesPosts).map((post) => ({ type: "post", content: post })),
      ...lightweightJobs(jobs).map((job) => ({ type: "job", content: job })),
      ...lightweightCompanies(randomCompanies).map((company) => ({ type: "companyRecommendation", content: company })),
      ...lightweightPosts(jobseekerPosts).map((post) => ({ type: "jobseekerRecommendation", content: post })),
    ].sort((a, b) => new Date(b.content.createdAt || b.content) - new Date(a.content.createdAt || a.content));

    const feed = allItems.slice(skip, skip + limit);

    const totalConnectionPosts = await Post.countDocuments({
      userId: { $in: userProfile.connections },
      visibility: "public",
    });

    const totalPublicPosts = await Post.countDocuments({
      userId: { $nin: userProfile.connections },
      visibility: "public",
    });

    const totalFollowedCompaniesPosts = await Post.countDocuments({
      userId: { $in: await UserProfile.distinct("userId", { companyId: { $in: userProfile.followedCompanies } }) },
      visibility: "public",
    });

    const totalJobs = await Job.countDocuments({
      companyId: { $in: userProfile.followedCompanies },
      status: "Open",
    });

    const totalCompanies = await Company.countDocuments({
      _id: { $nin: userProfile.followedCompanies },
      isDeleted: false,
    });

    const totalJobseekerPosts = await Post.countDocuments({
      userId: {
        $nin: [...userProfile.connections, ...(await UserProfile.distinct("userId", { companyId: { $in: userProfile.followedCompanies } }))],
      },
      visibility: "public",
      "userId.role": "Jobseeker",
    });

    const totalItems = totalConnectionPosts + totalPublicPosts + totalFollowedCompaniesPosts + totalJobs + totalCompanies + totalJobseekerPosts;

    res.status(200).json({
      message: feed.length === 0 ? "No items found in feed" : "Feed retrieved successfully",
      feed,
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