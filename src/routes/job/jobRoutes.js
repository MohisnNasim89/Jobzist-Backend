const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const jobController = require("../../controllers/job/jobController");
const jobJobSeekerController = require("../../controllers/job/jobJobSeekerController");
const jobPublicController = require("../../controllers/job/jobPublicController");
const jobValidation = require("../../validations/jobValidation");

router.post("/create", verifyToken, jobValidation.validateCreateJob, jobController.createJob);

router.put("/:jobId", verifyToken, jobValidation.validateUpdateJob, jobController.updateJob);

router.delete("/:jobId", verifyToken, jobValidation.validateJobId, jobController.deleteJob);

router.get("/:jobId", jobValidation.validateJobId, jobPublicController.getJob);

router.get("/", jobValidation.validateGetJobs, jobPublicController.getJobs);

router.post("/:jobId/apply", verifyToken, jobValidation.validateJobId, jobJobSeekerController.applyForJob);

router.post("/:jobId/save", verifyToken, jobValidation.validateJobId, jobJobSeekerController.saveJob);

router.get("/:userId/saved", verifyToken, jobValidation.validateUserId, jobJobSeekerController.getSavedJobs);

router.get("/:userId/applied", verifyToken, jobValidation.validateUserId, jobJobSeekerController.getAppliedJobs);

router.post("/:jobId/hire/:jobSeekerId", verifyToken, jobValidation.validateHireCandidate, jobController.hireCandidate);

router.get("/company/:companyId", jobValidation.validateGetCompanyJobs, jobPublicController.getCompanyJobs);

router.patch("/:jobId/status", verifyToken, jobValidation.validateJobId, jobController.toggleJobStatus);

module.exports = router;