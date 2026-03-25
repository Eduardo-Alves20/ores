const mongoose = require("mongoose");

function normalizeObjectIdInput(value) {
  return String(value || "").trim();
}

function isValidObjectIdInput(value) {
  const normalized = normalizeObjectIdInput(value);
  return !!normalized && mongoose.isValidObjectId(normalized);
}

function ensureValidObjectId(value, message = "Identificador invalido.") {
  const normalized = normalizeObjectIdInput(value);
  if (!isValidObjectIdInput(normalized)) {
    const error = new Error(message);
    error.status = 400;
    error.code = "INVALID_OBJECT_ID";
    throw error;
  }
  return normalized;
}

module.exports = {
  ensureValidObjectId,
  isValidObjectIdInput,
  normalizeObjectIdInput,
};
