const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("./accessControlService");

function userPermissions(user) {
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

function hasPerm(user, permission) {
  return hasAnyPermission(userPermissions(user), [permission]);
}

function hasOperationalWorkspace(user) {
  const perfil = String(user?.perfil || "").toLowerCase().trim();
  if (!perfil) return false;
  if (perfil !== PERFIS.USUARIO) return true;

  return [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.ACESSOS_VIEW,
    PERMISSIONS.USUARIOS_MANAGE,
  ].some((permission) => hasPerm(user, permission));
}

function resolveLandingRouteForUser(user) {
  const perfil = String(user?.perfil || "").toLowerCase().trim();
  if (!perfil) return "/login";

  if (perfil === PERFIS.USUARIO) {
    const tipoCadastro = String(user?.tipoCadastro || "").toLowerCase().trim();

    if (tipoCadastro === "familia" && hasPerm(user, PERMISSIONS.PORTAL_MINHA_FAMILIA)) {
      return "/minha-familia";
    }

    if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) return "/painel";
    if (hasPerm(user, PERMISSIONS.FAMILIAS_VIEW)) return "/familias";
    if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) return "/agenda";
    if (hasPerm(user, PERMISSIONS.PORTAL_MEUS_DADOS)) return "/meus-dados";
    return "/perfil";
  }

  if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) return "/painel";
  if (hasPerm(user, PERMISSIONS.FAMILIAS_VIEW)) return "/familias";
  if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) return "/agenda";
  return "/perfil";
}

module.exports = {
  hasOperationalWorkspace,
  resolveLandingRouteForUser,
};
