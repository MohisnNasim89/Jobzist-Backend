const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");

// Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName = "Jobzist_uploads";

    if (file.mimetype.startsWith("image/")) {
      folderName = "profile_pics";
    } else if (file.mimetype === "application/pdf") {
      folderName = "resumes";
    } else {
      folderName = "documents";
    }

    return {
      folder: folderName,
      public_id: `${Date.now()}-${file.originalname}`,
      allowed_formats: ['jpg', 'png', 'pdf', 'docx'],
      resource_type: "auto",
    };
  },
});

const upload = multer({ storage });

module.exports = upload;
