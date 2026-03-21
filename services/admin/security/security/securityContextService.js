const mongoose = require("mongoose");

function createSecurityActionError(message, redirectTo = "/seguranca/funcoes") {
  const error = new Error(message);
  error.redirectTo = redirectTo;
  return error;
}

function getSecurityActorId(req) {
  return req?.session?.user?.id || null;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "undefined" || value === null) return [];
  return [value];
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function resolveReturnTo(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "/seguranca/funcoes";
  if (!raw.startsWith("/")) return "/seguranca/funcoes";
  if (raw.startsWith("//")) return "/seguranca/funcoes";
  if (!raw.startsWith("/seguranca/funcoes")) return "/seguranca/funcoes";
  return raw;
}

function normalizeObjectId(rawValue) {
  return String(rawValue || "").trim();
}

function isValidObjectId(rawValue) {
  const value = normalizeObjectId(rawValue);
  return !!value && mongoose.Types.ObjectId.isValid(value);
}

module.exports = {
  createSecurityActionError,
  getSecurityActorId,
  isValidObjectId,
  normalizeObjectId,
  resolveReturnTo,
  slugify,
  toArray,
};
