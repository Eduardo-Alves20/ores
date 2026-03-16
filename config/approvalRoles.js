const APPROVAL_ROLES = Object.freeze({
  MEMBRO: "membro",
  PRESIDENTE: "presidente",
});

function normalizeApprovalRole(value, fallback = APPROVAL_ROLES.MEMBRO) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === APPROVAL_ROLES.PRESIDENTE) return APPROVAL_ROLES.PRESIDENTE;
  if (raw === APPROVAL_ROLES.MEMBRO) return APPROVAL_ROLES.MEMBRO;
  return fallback;
}

function getApprovalRoleLabel(value) {
  const normalized = normalizeApprovalRole(value, APPROVAL_ROLES.MEMBRO);
  return normalized === APPROVAL_ROLES.PRESIDENTE ? "Presidente" : "Membro votante";
}

module.exports = {
  APPROVAL_ROLES,
  normalizeApprovalRole,
  getApprovalRoleLabel,
};
