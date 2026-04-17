const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const PENDING_SESSION_KEY = "secureVolunteerUploads";
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), "storage", "secure-uploads");
const DEFAULT_PENDING_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const DOCUMENT_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PHOTO_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ASSET_DEFINITIONS = Object.freeze({
  documentoIdentidade: {
    kind: "documentoIdentidade",
    label: "Documento de identidade",
    allowedMimeTypes: DOCUMENT_MIME_TYPES,
    allowedExtensions: ["pdf", "jpg", "jpeg", "png", "webp"],
    purpose: "identidade_aprovacao",
    maxBytes: resolveMaxBytes(process.env.VOLUNTEER_DOCUMENT_MAX_MB, 8),
  },
  fotoPerfil: {
    kind: "fotoPerfil",
    label: "Foto de perfil ou cracha",
    allowedMimeTypes: PHOTO_MIME_TYPES,
    allowedExtensions: ["jpg", "jpeg", "png", "webp"],
    purpose: "perfil_cracha_futuro",
    maxBytes: resolveMaxBytes(process.env.VOLUNTEER_PROFILE_PHOTO_MAX_MB, 5),
  },
});

function resolveMaxBytes(rawValue, fallbackMb) {
  const parsed = Number(rawValue);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed * 1024 * 1024);
  }
  return fallbackMb * 1024 * 1024;
}

function createSecureAssetError(message, status = 400, code = "SECURE_ASSET_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeAssetKind(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "documentoidentidade" || raw === "documento_identidade") {
    return "documentoIdentidade";
  }
  if (raw === "fotoperfil" || raw === "foto_perfil") {
    return "fotoPerfil";
  }
  return "";
}

function getAssetDefinition(kind) {
  const normalizedKind = normalizeAssetKind(kind);
  return ASSET_DEFINITIONS[normalizedKind] || null;
}

function resolveStorageRoot() {
  return path.resolve(String(process.env.SECURE_UPLOADS_DIR || DEFAULT_STORAGE_ROOT));
}

function ensureStoragePath(storageKey) {
  const root = resolveStorageRoot();
  const relativeKey = String(storageKey || "").trim();
  if (!relativeKey) {
    throw createSecureAssetError("Caminho do arquivo protegido ausente.", 500, "SECURE_ASSET_PATH_MISSING");
  }

  const normalizedRelativePath = path.normalize(relativeKey);
  if (
    path.isAbsolute(normalizedRelativePath) ||
    normalizedRelativePath.startsWith("..") ||
    normalizedRelativePath.includes(`..${path.sep}`)
  ) {
    throw createSecureAssetError(
      "Caminho do arquivo protegido invalido.",
      500,
      "SECURE_ASSET_PATH_INVALID"
    );
  }

  const absolutePath = path.resolve(root, normalizedRelativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw createSecureAssetError(
      "Caminho do arquivo protegido fora da area permitida.",
      500,
      "SECURE_ASSET_PATH_OUTSIDE_ROOT"
    );
  }

  return absolutePath;
}

function sanitizeFileName(value) {
  const normalized = String(value || "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return normalized || "arquivo";
}

function normalizeFileExtension(fileName) {
  return path.extname(String(fileName || "").trim()).replace(/^\./, "").toLowerCase();
}

function detectMimeTypeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return "";
  }

  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return "";
}

function resolveEncryptionKey() {
  const baseKeyMaterial =
    String(process.env.SECURE_FILE_ENCRYPTION_KEY || "").trim() ||
    String(process.env.SECRET || "").trim() ||
    String(process.env.COOKIE_PARSER_KEY || "").trim() ||
    "ORES-secure-file-key-change-me";

  return crypto.createHash("sha256").update(baseKeyMaterial).digest();
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, resolveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
    encryptedBuffer: encrypted,
  };
}

function decryptBuffer(encryptedBuffer, asset = {}) {
  const iv = Buffer.from(String(asset.ivHex || ""), "hex");
  const authTag = Buffer.from(String(asset.authTagHex || ""), "hex");

  if (iv.length !== 12 || authTag.length !== 16) {
    throw createSecureAssetError(
      "Metadados de criptografia invalidos.",
      500,
      "SECURE_ASSET_CRYPTO_INVALID"
    );
  }

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, resolveEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

function ensureAllowedUpload(file, definition) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw createSecureAssetError("Envie um arquivo valido.", 400, "SECURE_ASSET_FILE_REQUIRED");
  }

  if (!definition) {
    throw createSecureAssetError("Tipo de anexo protegido invalido.", 400, "SECURE_ASSET_KIND_INVALID");
  }

  if (file.buffer.length > definition.maxBytes) {
    throw createSecureAssetError(
      `O arquivo excede o limite de ${formatBytes(definition.maxBytes)}.`,
      400,
      "SECURE_ASSET_TOO_LARGE"
    );
  }

  const detectedMimeType = detectMimeTypeFromBuffer(file.buffer);
  const declaredMimeType = String(file.mimetype || "").trim().toLowerCase();
  const extension = normalizeFileExtension(file.originalname);

  if (!detectedMimeType || !definition.allowedMimeTypes.includes(detectedMimeType)) {
    throw createSecureAssetError(
      "Formato de arquivo nao permitido. Use PDF, JPG, PNG ou WEBP conforme o campo.",
      400,
      "SECURE_ASSET_INVALID_FORMAT"
    );
  }

  if (!definition.allowedExtensions.includes(extension)) {
    throw createSecureAssetError(
      "Extensao do arquivo nao permitida para este campo.",
      400,
      "SECURE_ASSET_INVALID_EXTENSION"
    );
  }

  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    const compatibleJpeg =
      declaredMimeType === "image/jpg" && detectedMimeType === "image/jpeg";
    if (!compatibleJpeg) {
      throw createSecureAssetError(
        "O tipo real do arquivo nao confere com o tipo enviado.",
        400,
        "SECURE_ASSET_MIME_MISMATCH"
      );
    }
  }

  return {
    extension,
    mimeType: detectedMimeType,
  };
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let current = bytes;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const digits = current >= 10 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(digits)} ${units[unitIndex]}`;
}

function buildAssetStorageKey(segment, kind, fileName) {
  return path.join(segment, kind, fileName);
}

function normalizeStoredProtectedAsset(input, expectedKind = "") {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const definition = getAssetDefinition(input.kind || expectedKind);
  if (!definition) return null;

  const storageKey = String(input.storageKey || "").trim();
  if (!storageKey) return null;

  const normalized = {
    assetId: String(input.assetId || "").trim().slice(0, 64),
    kind: definition.kind,
    label: definition.label,
    originalName: sanitizeFileName(input.originalName),
    mimeType: String(input.mimeType || "").trim().toLowerCase(),
    extension: normalizeFileExtension(input.extension || input.originalName),
    size: Math.max(0, Number(input.size || 0)),
    storageKey,
    ivHex: String(input.ivHex || "").trim().toLowerCase(),
    authTagHex: String(input.authTagHex || "").trim().toLowerCase(),
    sha256: String(input.sha256 || "").trim().toLowerCase(),
    uploadedAt: input.uploadedAt ? new Date(input.uploadedAt) : new Date(),
    uploadedBy: String(input.uploadedBy || "").trim() || null,
    ownerId: String(input.ownerId || "").trim() || null,
    purpose: String(input.purpose || definition.purpose).trim() || definition.purpose,
    encryptionAlgorithm: ENCRYPTION_ALGORITHM,
  };

  if (!normalized.assetId || !normalized.mimeType || !normalized.ivHex || !normalized.authTagHex) {
    return null;
  }

  try {
    ensureStoragePath(normalized.storageKey);
  } catch (_) {
    return null;
  }

  return normalized;
}

function sanitizeProtectedAssetForClient(asset) {
  const normalized = normalizeStoredProtectedAsset(asset);
  if (!normalized) return null;

  return {
    available: true,
    assetId: normalized.assetId,
    kind: normalized.kind,
    label: normalized.label,
    originalName: normalized.originalName,
    mimeType: normalized.mimeType,
    size: normalized.size,
    sizeLabel: formatBytes(normalized.size),
    uploadedAt: normalized.uploadedAt,
    isImage: normalized.mimeType.startsWith("image/"),
    isPdf: normalized.mimeType === "application/pdf",
  };
}

function sanitizeProtectedAttachmentBundleForClient(bundle = {}) {
  return {
    documentoIdentidade: sanitizeProtectedAssetForClient(bundle?.documentoIdentidade),
    fotoPerfil: sanitizeProtectedAssetForClient(bundle?.fotoPerfil),
  };
}

async function storePendingProtectedAsset({ kind, file, actorId = null }) {
  const definition = getAssetDefinition(kind);
  const validated = ensureAllowedUpload(file, definition);
  const assetId = crypto.randomUUID();
  const now = new Date();
  const fileName = `${assetId}.bin`;
  const storageKey = buildAssetStorageKey(
    path.join("pending", now.getUTCFullYear().toString(), String(now.getUTCMonth() + 1).padStart(2, "0")),
    definition.kind,
    fileName
  );
  const absolutePath = ensureStoragePath(storageKey);
  const encrypted = encryptBuffer(file.buffer);

  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, encrypted.encryptedBuffer);

  return {
    assetId,
    kind: definition.kind,
    label: definition.label,
    originalName: sanitizeFileName(file.originalname),
    mimeType: validated.mimeType,
    extension: validated.extension,
    size: file.buffer.length,
    storageKey,
    ivHex: encrypted.ivHex,
    authTagHex: encrypted.authTagHex,
    sha256: crypto.createHash("sha256").update(file.buffer).digest("hex"),
    uploadedAt: now,
    uploadedBy: actorId ? String(actorId) : null,
    ownerId: null,
    purpose: definition.purpose,
    encryptionAlgorithm: ENCRYPTION_ALGORITHM,
  };
}

function ensurePendingUploadContainer(session) {
  if (!session || typeof session !== "object") {
    throw createSecureAssetError(
      "Sessao indisponivel para controlar anexos protegidos.",
      500,
      "SECURE_ASSET_SESSION_REQUIRED"
    );
  }

  if (!session[PENDING_SESSION_KEY] || typeof session[PENDING_SESSION_KEY] !== "object") {
    session[PENDING_SESSION_KEY] = {};
  }

  return session[PENDING_SESSION_KEY];
}

async function pruneExpiredPendingUploads(session, maxAgeMs = DEFAULT_PENDING_MAX_AGE_MS) {
  if (!session || !session[PENDING_SESSION_KEY] || typeof session[PENDING_SESSION_KEY] !== "object") {
    return;
  }

  const entries = Object.entries(session[PENDING_SESSION_KEY]);
  const now = Date.now();

  for (const [token, item] of entries) {
    const createdAt = new Date(item?.createdAt || 0).getTime();
    if (!createdAt || now - createdAt <= maxAgeMs) continue;

    await deleteProtectedAsset(item?.asset || null).catch(() => {});
    delete session[PENDING_SESSION_KEY][token];
  }
}

async function registerPendingUpload({ session, kind, file, actorId = null }) {
  await pruneExpiredPendingUploads(session);
  const pendingUploads = ensurePendingUploadContainer(session);
  const asset = await storePendingProtectedAsset({ kind, file, actorId });
  const token = crypto.randomBytes(24).toString("hex");

  pendingUploads[token] = {
    createdAt: new Date().toISOString(),
    asset,
  };

  return {
    token,
    asset: sanitizeProtectedAssetForClient(asset),
  };
}

function consumePendingUpload(session, token, expectedKind = "") {
  const pendingUploads = ensurePendingUploadContainer(session);
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;

  const entry = pendingUploads[normalizedToken];
  delete pendingUploads[normalizedToken];

  if (!entry?.asset) return null;

  const normalized = normalizeStoredProtectedAsset(entry.asset, expectedKind);
  if (!normalized) return null;

  if (expectedKind && normalized.kind !== normalizeAssetKind(expectedKind)) {
    return null;
  }

  return normalized;
}

async function promotePendingProtectedAsset(asset, { userId, actorId = null } = {}) {
  const normalizedAsset = normalizeStoredProtectedAsset(asset);
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedAsset) {
    throw createSecureAssetError(
      "Anexo protegido temporario invalido.",
      400,
      "SECURE_ASSET_PENDING_INVALID"
    );
  }

  if (!normalizedUserId) {
    throw createSecureAssetError(
      "Usuario de destino ausente para o anexo protegido.",
      500,
      "SECURE_ASSET_TARGET_REQUIRED"
    );
  }

  const currentPath = ensureStoragePath(normalizedAsset.storageKey);
  const nextStorageKey = buildAssetStorageKey(
    path.join("users", normalizedUserId),
    normalizedAsset.kind,
    `${normalizedAsset.assetId}.bin`
  );
  const nextPath = ensureStoragePath(nextStorageKey);

  await fs.promises.mkdir(path.dirname(nextPath), { recursive: true });
  await fs.promises.rename(currentPath, nextPath);

  return {
    ...normalizedAsset,
    storageKey: nextStorageKey,
    ownerId: normalizedUserId,
    uploadedBy: actorId ? String(actorId) : normalizedAsset.uploadedBy,
  };
}

async function storeProtectedAssetForUser({ kind, file, userId, actorId = null } = {}) {
  const pendingAsset = await storePendingProtectedAsset({ kind, file, actorId });

  try {
    return await promotePendingProtectedAsset(pendingAsset, { userId, actorId });
  } catch (error) {
    await deleteProtectedAsset(pendingAsset).catch(() => {});
    throw error;
  }
}

async function deleteProtectedAsset(asset) {
  const normalized = normalizeStoredProtectedAsset(asset);
  if (!normalized) return;

  const absolutePath = ensureStoragePath(normalized.storageKey);
  await fs.promises.rm(absolutePath, { force: true });
}

async function readProtectedAssetBuffer(asset) {
  const normalized = normalizeStoredProtectedAsset(asset);
  if (!normalized) {
    throw createSecureAssetError("Anexo protegido nao encontrado.", 404, "SECURE_ASSET_NOT_FOUND");
  }

  const absolutePath = ensureStoragePath(normalized.storageKey);
  const encryptedBuffer = await fs.promises.readFile(absolutePath);
  const buffer = decryptBuffer(encryptedBuffer, normalized);

  return {
    asset: normalized,
    buffer,
  };
}

module.exports = {
  ASSET_DEFINITIONS,
  DEFAULT_PENDING_MAX_AGE_MS,
  ENCRYPTION_ALGORITHM,
  PENDING_SESSION_KEY,
  consumePendingUpload,
  createSecureAssetError,
  deleteProtectedAsset,
  detectMimeTypeFromBuffer,
  formatBytes,
  getAssetDefinition,
  normalizeAssetKind,
  normalizeStoredProtectedAsset,
  promotePendingProtectedAsset,
  pruneExpiredPendingUploads,
  readProtectedAssetBuffer,
  registerPendingUpload,
  sanitizeProtectedAssetForClient,
  sanitizeProtectedAttachmentBundleForClient,
  storeProtectedAssetForUser,
  storePendingProtectedAsset,
};
