const Job = require("../../models/job/Job");
const {
  checkRole,
  checkJobExists,
  checkJobSeekerExists,
  renderProfileWithFallback,
} = require("../../utils/checks");

exports.applyForJob = async (req, res) => {
  const { jobId } = req.params;
  const { userId, role } = req.user;

  checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can apply for jobs");

  const job = await checkJobExists(jobId);
  if (job.status !== "Open") {
    throw new Error("This job is not open for applications", { status: 400 });
  }

  const applicationDeadline = new Date(job.applicationDeadline);
  if (applicationDeadline < new Date()) {
    throw new Error("Application deadline has passed", { status: 400 });
  }

  const jobSeeker = await checkJobSeekerExists(userId);

  const alreadyApplied = job.applicants.some((applicant) => applicant.userId.toString() === userId);
  if (alreadyApplied) {
    throw new Error("You have already applied for this job", { status: 400 });
  }

  job.applicants.push({ userId: userId });
  await job.save();

  jobSeeker.appliedJobs.push({ jobId });
  await jobSeeker.save();

  res.status(200).json({ message: "Application submitted successfully" });
};

exports.saveJob = async (req, res) => {
  const { jobId } = req.params;
  const { userId, role } = req.user;

  checkRole(role, ["job_seeker"], "Unauthorized: Only job seekers can save jobs");

  const job = await checkJobExists(jobId);
  const jobSeeker = await checkJobSeekerExists(userId);

  const alreadySaved = jobSeeker.savedJobs.some((savedJob) => savedJob.jobId.toString() === jobId);
  const alreadySavedInJob = job.savedBy.some((saved) => saved.jobSeekerId.toString() === userId);
  if (alreadySaved || alreadySavedInJob) {
    throw new Error("You have already saved this job", { status: 400 });
  }

  jobSeeker.savedJobs.push({ jobId });
  job.savedBy.push({ jobSeekerId: userId });
  await jobSeeker.save();
  await job.save();

  res.status(200).json({ message: "Job saved successfully" });
};

exports.getSavedJobs = async (req, res) => {
  const { userId } = req.params;
  const { userId: authenticatedUserId, role } = req.user;

  checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own saved jobs");
  if (userId !== authenticatedUserId) {
    throw new Error("Unauthorized: You can only view your own saved jobs", { status: 403 });
  }

  const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false }).populate({
    path: "savedJobs.jobId",
    match: { isDeleted: false },
    populate: [
      { path: "companyId", select: "name logo", match: { isDeleted: false } },
      { path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } },
    ],
  });

  if (!jobSeeker) {
    throw new Error("Job seeker profile not found", { status: 404 });
  }

  const savedJobs = jobSeeker.savedJobs
    .filter((savedJob) => savedJob.jobId)
    .map((savedJob) => {
      const jobProfile = renderProfileWithFallback(savedJob.jobId, "job", {
        _id: savedJob.jobId._id,
        title: savedJob.jobId.title,
        company: savedJob.jobId.companyId ? { _id: savedJob.jobId.companyId._id, name: savedJob.jobId.companyId.name, logo: savedJob.jobId.companyId.logo } : null,
        postedBy: savedJob.jobId.postedBy?.profileId?.fullName || "Unknown",
        location: savedJob.jobId.location,
        jobType: savedJob.jobId.jobType,
        salary: savedJob.jobId.salary,
        experienceLevel: savedJob.jobId.experienceLevel,
        applicationDeadline: savedJob.jobId.applicationDeadline,
        status: savedJob.jobId.status,
        createdAt: savedJob.jobId.createdAt,
        savedAt: savedJob.savedAt,
      });
      return {
        ...jobProfile,
        savedAt: savedJob.savedAt,
      };
    });

  res.status(200).json({
    message: "Saved jobs retrieved successfully",
    savedJobs,
  });
};

exports.getAppliedJobs = async (req, res) => {
  const { userId } = req.params;
  const { userId: authenticatedUserId, role } = req.user;

  checkRole(role, ["job_seeker"], "Unauthorized: You can only view your own applied jobs");
  if (userId !== authenticatedUserId) {
    throw new Error("Unauthorized: You can only view your own applied jobs", { status: 403 });
  }

  const jobSeeker = await JobSeeker.findOne({ userId, isDeleted: false }).populate({
    path: "appliedJobs.jobId",
    match: { isDeleted: false },
    populate: [
      { path: "companyId", select: "name logo", match: { isDeleted: false } },
      { path: "postedBy", populate: { path: "profileId", select: "fullName", match: { isDeleted: false } } },
    ],
  });

  if (!jobSeeker) {
    throw new Error("Job seeker profile not found", { status: 404 });
  }

  const appliedJobs = jobSeeker.appliedJobs
    .filter((appliedJob) => appliedJob.jobId)
    .map((appliedJob) => {
      const jobProfile = renderProfileWithFallback(appliedJob.jobId, "job", {
        _id: appliedJob.jobId._id,
        title: appliedJob.jobId.title,
        company: appliedJob.jobId.companyId ? { _id: appliedJob.jobId.companyId._id, name: appliedJob.jobId.companyId.name, logo: appliedJob.jobId.companyId.logo } : null,
        postedBy: appliedJob.jobId.postedBy?.profileId?.fullName || "Unknown",
        location: appliedJob.jobId.location,
        jobType: appliedJob.jobId.jobType,
        salary: appliedJob.jobId.salary,
        experienceLevel: appliedJob.jobId.experienceLevel,
        applicationDeadline: appliedJob.jobId.applicationDeadline,
        status: appliedJob.jobId.status,
        createdAt: appliedJob.jobId.createdAt,
        appliedAt: appliedJob.appliedAt,
      });
      return {
        ...jobProfile,
        appliedAt: appliedJob.appliedAt,
      };
    });

  res.status(200).json({
    message: "Applied jobs retrieved successfully",
    appliedJobs,
  });
};