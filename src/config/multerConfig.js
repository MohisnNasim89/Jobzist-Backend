const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinaryConfig");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folderName;

    if (req.uploadType === "profilePicture") {
      folderName = "profilePictures";
    } else if (file.mimetype.startsWith("image/")) {
      folderName = "posts/images";
    } else if (file.mimetype.startsWith("video/")) {
      folderName = "posts/videos";
    } else if (file.mimetype === "application/pdf") {
      folderName = "resumes";
    } else {
      throw new Error("Unsupported file type");
    }

    const userId = req.user?.userId || "anonymous";
    const now = new Date();
    const isoTimestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(now.getMilliseconds()).padStart(3, "0")}`; // e.g., 20250601-020210620
    const fileIndex = req.files ? req.files.findIndex((f) => f.fieldname === file.fieldname) + 1 : 1;

    const publicId = `${userId}-${isoTimestamp}-${fileIndex}`;
    file.publicId = publicId; // Attach publicId to the file object

    return {
      folder: folderName,
      public_id: publicId,
      allowed_formats: req.uploadType === "profilePicture" || file.mimetype.startsWith("image/")
        ? ["jpg", "png", "jpeg"]
        : file.mimetype.startsWith("video/")
        ? ["mp4", "MOV", "mov"]
        : ["pdf"],
      resource_type: req.uploadType === "profilePicture" || file.mimetype.startsWith("image/") || file.mimetype === "application/pdf"
        ? "image"
        : "video",
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "video/mp4", "video/MOV", "video/mov", "application/pdf"];
    console.log(`File type ${file.mimetype} is allowed.`);
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed types: jpg, png, mp4, mov, pdf"), false);
    }
  },
});

module.exports = upload;