const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { sanitizeForLog } = require("./logSanitizerService");

const DEFAULT_LOG_RELATIVE_PATH = path.join("logs", "security-events.log");
const MAX_EVENT_TYPE_LENGTH = 80;
const MAX_SEVERITY_LENGTH = 16;
const HASH_STATE_BY_PATH = new Map();

function resolveSecurityEventLogPath(customPath = "") {
  const envPath = String(process.env.SECURITY_EVENT_LOG_PATH || "").trim();
  const rawPath = String(customPath || envPath || DEFAULT_LOG_RELATIVE_PATH).trim();
  return path.resolve(process.cwd(), rawPath);
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeEventType(eventType) {
  const normalized = String(eventType || "SECURITY_EVENT")
    .trim()
    .toUpperCase()
    .replace(/[^\w.\-:]/g, "_");

  return normalized.slice(0, MAX_EVENT_TYPE_LENGTH) || "SECURITY_EVENT";
}

function normalizeSeverity(severity) {
  const normalized = String(severity || "info").trim().toLowerCase();
  const safe = normalized.replace(/[^\w.\-]/g, "");
  if (!safe) return "info";
  return safe.slice(0, MAX_SEVERITY_LENGTH);
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const output = {};

    keys.forEach((key) => {
      output[key] = stableValue(value[key]);
    });

    return output;
  }

  return value;
}

function stringifyForHashing(value) {
  return JSON.stringify(stableValue(value));
}

function computeSecurityEventHash(record) {
  return crypto
    .createHash("sha256")
    .update(stringifyForHashing(record), "utf8")
    .digest("hex");
}

function readLastHashFromFile(logPath) {
  try {
    if (!fs.existsSync(logPath)) return "";

    const raw = fs.readFileSync(logPath, "utf8");
    if (!raw.trim()) return "";

    const lines = raw.trim().split(/\r?\n/);
    const lastLine = lines.at(-1);
    if (!lastLine) return "";

    const parsed = JSON.parse(lastLine);
    return String(parsed?.hash || "").trim();
  } catch (_) {
    return "";
  }
}

function resolvePreviousHash(logPath) {
  if (HASH_STATE_BY_PATH.has(logPath)) {
    return HASH_STATE_BY_PATH.get(logPath) || "";
  }

  const fileHash = readLastHashFromFile(logPath);
  HASH_STATE_BY_PATH.set(logPath, fileHash);
  return fileHash;
}

function logSecurityEvent(event = {}, options = {}) {
  const logPath = resolveSecurityEventLogPath(options.filePath);
  ensureParentDirectory(logPath);

  const previousHash = resolvePreviousHash(logPath);
  const timestamp = new Date().toISOString();
  const payload = sanitizeForLog(event.payload || {}, "payload");

  const recordWithoutHash = {
    ts: timestamp,
    type: normalizeEventType(event.type),
    severity: normalizeSeverity(event.severity),
    actorId: String(event.actorId || "").trim() || null,
    ip: String(event.ip || "").trim() || null,
    method: String(event.method || "").trim().toUpperCase() || null,
    route: String(event.route || "").trim() || null,
    userAgent: String(event.userAgent || "").trim() || null,
    prevHash: previousHash || null,
    payload,
  };

  const hash = computeSecurityEventHash(recordWithoutHash);
  const finalRecord = {
    ...recordWithoutHash,
    hash,
  };

  fs.appendFileSync(logPath, `${JSON.stringify(finalRecord)}\n`, "utf8");
  HASH_STATE_BY_PATH.set(logPath, hash);

  return finalRecord;
}

module.exports = {
  DEFAULT_LOG_RELATIVE_PATH,
  computeSecurityEventHash,
  logSecurityEvent,
  normalizeEventType,
  normalizeSeverity,
  resolveSecurityEventLogPath,
  stringifyForHashing,
};
