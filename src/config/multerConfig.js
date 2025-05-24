// multerConfig.js
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName;

    if (file.mimetype.startsWith("image/")) {
      folderName = "posts/images";
    } else if (file.mimetype.startsWith("video/")) {
      folderName = "posts/videos";
    } else if (file.mimetype === "application/pdf") {
      folderName = "resumes";
    } else {
      throw new Error("Unsupported file type");
    }

    return {
      folder: folderName,
      public_id: `${Date.now()}-${file.originalname}`,
      allowed_formats: file.mimetype.startsWith("image/") ? ["jpg", "png", "jpeg"] : file.mimetype.startsWith("video/") ? ["mp4", "mov"] : ["pdf"],
      resource_type: file.mimetype.startsWith("image/") || file.mimetype === "application/pdf" ? "image" : "video",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "video/mp4", "video/mov", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed types: jpg, png, mp4, mov, pdf"), false);
    }
  },
});

module.exports = upload; 