const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const jobController = require("../../controllers/job/jobController");
const jobJobSeekerController = require("../../controllers/job/jobJobSeekerController");
const jobPublicController = require("../../controllers/job/jobPublicController");
const jobValidation = require("../../validations/jobValidation");
const { aiRateLimiter } = require("../../middlewares/rateLimiter");

router.post("/create", verifyToken, jobValidation.validateCreateJob, jobController.createJob);

router.put("/:jobId", verifyToken, jobValidation.validateUpdateJob, jobController.updateJob);

router.delete("/:jobId", verifyToken, jobValidation.validateJobId, jobController.deleteJob);

router.get("/:jobId", jobValidation.validateJobId, jobPublicController.getJob);

router.get("/", jobValidation.validateGetJobs, jobPublicController.getJobs);

router.post("/:jobId/apply", verifyToken, jobValidation.validateJobId, jobJobSeekerController.applyForJob);

router.post("/:jobId/save", verifyToken, jobValidation.validateJobId, jobJobSeekerController.saveJob);

router.get("/:userId/saved", verifyToken, jobValidation.validateUserId, jobJobSeekerController.getSavedJobs);

router.get("/:userId/applied", verifyToken, jobValidation.validateUserId, jobJobSeekerController.getAppliedJobs);

router.get("/:userId/offers", verifyToken, jobValidation.validateUserId, jobJobSeekerController.getJobOffers);

router.post("/:jobId/offer/respond", verifyToken, jobValidation.validateJobId, jobJobSeekerController.respondToJobOffer);

router.get("/:jobId/applicants", verifyToken, jobValidation.validateJobId, jobController.getJobApplicants);

router.post("/:jobId/hire/:jobSeekerId", verifyToken, jobValidation.validateHireCandidate, jobController.hireCandidate);

router.get("/company/:companyId", jobValidation.validateGetCompanyJobs, jobPublicController.getCompanyJobs);

router.patch("/:jobId/status", verifyToken, jobValidation.validateJobId, jobController.toggleJobStatus);

router.get("/:jobId/applicant/:jobSeekerId/resume/preview", verifyToken, jobValidation.validateJobId, jobController.previewApplicantResume);

router.get("/:jobId/applicant/:jobSeekerId/resume/download", verifyToken, jobValidation.validateJobId, jobController.downloadApplicantResume);

router.post("/:jobId/ats-score", aiRateLimiter, verifyToken, jobValidation.validateJobId, jobJobSeekerController.getATSScoreAndSuggestions);

router.post("/:jobId/cover-letter", aiRateLimiter, verifyToken, jobValidation.validateJobId, jobJobSeekerController.generateCoverLetterForJob);

module.exports = router;