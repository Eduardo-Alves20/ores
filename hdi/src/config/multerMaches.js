const multer = require("multer");
const {
  ATTACHMENTS_DIR,
  buildStoredFilename,
  ensureUploadDirectories,
  isAllowedFile,
} = require("../services/uploadSecurityService");

ensureUploadDirectories();

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rar",
  ".txt",
  ".webp",
  ".xls",
  ".xlsx",
  ".zip",
  ".7z",
]);

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, ATTACHMENTS_DIR);
  },
  filename(req, file, cb) {
    cb(null, buildStoredFilename(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  if (
    !isAllowedFile(file, {
      allowedExtensions: ALLOWED_ATTACHMENT_EXTENSIONS,
      allowedMimeTypes: ALLOWED_ATTACHMENT_MIME_TYPES,
    })
  ) {
    cb(new Error("Tipo de arquivo nao permitido."), false);
    return;
  }

  cb(null, true);
}

const uploadAttachment = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { uploadAttachment };
