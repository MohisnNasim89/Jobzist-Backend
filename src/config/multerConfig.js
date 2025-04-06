const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");

// Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName;

    if (file.mimetype.startsWith("image/")) {
      folderName = "profile_pics";
    } else if (file.mimetype === "application/pdf") {
      folderName = "resumes";
    } else {
      throw new Error("Unsupported file type");
    }

    return {
      folder: folderName,
      public_id: `${Date.now()}-${file.originalname}`,
      allowed_formats: ["jpg", "png", "pdf"],
      resource_type: "auto",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;