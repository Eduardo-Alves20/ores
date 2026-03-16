const PERFIS = Object.freeze({
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  ATENDENTE: "atendente",
  TECNICO: "tecnico",
  USUARIO: "usuario",
});

const PERFIS_LIST = Object.freeze(Object.values(PERFIS));

function normalizeProfileValue(value, fallback = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin_alento") return PERFIS.ADMIN;
  if (raw === PERFIS.ADMIN) return PERFIS.ADMIN;
  if (raw === PERFIS.SUPERADMIN) return PERFIS.SUPERADMIN;
  if (raw === PERFIS.ATENDENTE) return PERFIS.ATENDENTE;
  if (raw === PERFIS.TECNICO) return PERFIS.TECNICO;
  if (raw === PERFIS.USUARIO) return PERFIS.USUARIO;
  return fallback;
}

function isAdminProfile(value) {
  const normalized = normalizeProfileValue(value);
  return normalized === PERFIS.ADMIN || normalized === PERFIS.SUPERADMIN;
}

function getProfileLabel(value) {
  const normalized = normalizeProfileValue(value);
  if (normalized === PERFIS.SUPERADMIN) return "SuperAdmin";
  if (normalized === PERFIS.ADMIN) return "admin_alento";
  if (normalized === PERFIS.ATENDENTE) return "Atendente";
  if (normalized === PERFIS.TECNICO) return "Tecnico";
  if (normalized === PERFIS.USUARIO) return "Usuario";
  return String(value || "").trim() || "Usuario";
}

module.exports = {
  PERFIS,
  PERFIS_LIST,
  normalizeProfileValue,
  isAdminProfile,
  getProfileLabel,
};
