const multer = require("multer");
const {
  UPLOADS_BASE_DIR,
  buildStoredFilename,
  ensureUploadDirectories,
  isAllowedFile,
} = require("../services/uploadSecurityService");

ensureUploadDirectories();

const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOADS_BASE_DIR);
  },
  filename(req, file, cb) {
    cb(null, buildStoredFilename(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  if (
    isAllowedFile(file, {
      allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    })
  ) {
    cb(null, true);
    return;
  }

  cb(new Error("Apenas imagens seguras sao permitidas."), false);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
