const FAMILY_APPOINTMENT_LIMIT_OPTIONS = Object.freeze([6, 12, 24, 40]);
const FAMILY_NOTIFICATION_LIMIT_OPTIONS = Object.freeze([10, 20, 40, 60]);

function isFamilyPortalUser(usuario = {}) {
  return String(usuario?.tipoCadastro || "").trim().toLowerCase() === "familia";
}

function sanitizeExternalText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

module.exports = {
  FAMILY_APPOINTMENT_LIMIT_OPTIONS,
  FAMILY_NOTIFICATION_LIMIT_OPTIONS,
  isFamilyPortalUser,
  sanitizeExternalText,
};
