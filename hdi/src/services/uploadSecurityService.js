const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const UPLOADS_BASE_DIR = path.resolve(__dirname, "..", "uploads");
const ATTACHMENTS_DIR = path.join(UPLOADS_BASE_DIR, "attachments");

function ensureUploadDirectories() {
  fs.mkdirSync(UPLOADS_BASE_DIR, { recursive: true });
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

function sanitizeOriginalFilename(filename) {
  const base = path.basename(String(filename || "arquivo"));
  const cleaned = base
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned || "arquivo";
}

function getSanitizedExtension(filename) {
  return String(path.extname(sanitizeOriginalFilename(filename))).toLowerCase();
}

function buildStoredFilename(filename, fallbackExtension = "") {
  const extension = getSanitizedExtension(filename) || String(fallbackExtension || "");
  return `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`;
}

function ensurePathInsideUploads(absolutePath) {
  const resolved = path.resolve(String(absolutePath || ""));
  const baseWithSep = `${UPLOADS_BASE_DIR}${path.sep}`;

  if (resolved !== UPLOADS_BASE_DIR && !resolved.startsWith(baseWithSep)) {
    throw new Error("Caminho fora da area de upload.");
  }

  return resolved;
}

function resolveUploadUrlToAbsolutePath(uploadUrl) {
  const raw = String(uploadUrl || "").trim();
  if (!raw) return null;

  const normalized = raw.replace(/\\/g, "/");
  if (!normalized.startsWith("/uploads/")) {
    throw new Error("URL de upload invalida.");
  }

  const relativePath = normalized.slice("/uploads/".length);
  return ensurePathInsideUploads(path.resolve(UPLOADS_BASE_DIR, relativePath));
}

async function safeUnlinkUploadUrl(uploadUrl) {
  const absolutePath = resolveUploadUrlToAbsolutePath(uploadUrl);
  if (!absolutePath) return false;

  try {
    await fs.promises.unlink(absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function safeUnlinkAbsolutePath(absolutePath) {
  const resolved = ensurePathInsideUploads(absolutePath);

  try {
    await fs.promises.unlink(resolved);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function isAllowedFile(file, { allowedExtensions, allowedMimeTypes }) {
  const extension = getSanitizedExtension(file?.originalname);
  const mimetype = String(file?.mimetype || "").trim().toLowerCase();

  return allowedExtensions.has(extension) && allowedMimeTypes.has(mimetype);
}

module.exports = {
  ATTACHMENTS_DIR,
  UPLOADS_BASE_DIR,
  buildStoredFilename,
  ensureUploadDirectories,
  getSanitizedExtension,
  isAllowedFile,
  resolveUploadUrlToAbsolutePath,
  safeUnlinkAbsolutePath,
  safeUnlinkUploadUrl,
  sanitizeOriginalFilename,
};
