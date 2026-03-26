const { PERFIS } = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const UsuarioService = require("../../domain/UsuarioService");
const {
  hasAnyPermission,
  resolvePermissionsForUserId,
} = require("../../accessControlService");
const { buildSessionUserPayload } = require("../../security/sessionSecurityService");

function getCurrentUserId(req) {
  return req?.session?.user?.id || null;
}

function getCurrentProfile(req) {
  return String(req?.session?.user?.perfil || "").trim().toLowerCase();
}

function isSuperAdminRequest(req) {
  return getCurrentProfile(req) === PERFIS.SUPERADMIN;
}

function isAdminRequest(req) {
  const user = req?.session?.user || {};
  const perfil = getCurrentProfile(req);
  if (perfil === PERFIS.SUPERADMIN) return true;
  if (perfil === PERFIS.ADMIN) {
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (!permissions.length) return true;
    if (hasAnyPermission(permissions, [PERMISSIONS.CONTA_EDIT_ALL])) return true;
  }
  return false;
}

async function loadCurrentAccountContext(req) {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return { redirectTo: "/login" };
  }

  const usuario = await UsuarioService.buscarPorId(userId);
  if (!usuario) {
    return { redirectTo: "/login" };
  }

  return {
    userId,
    profile: getCurrentProfile(req),
    usuario,
    isAdmin: isAdminRequest(req),
    isSuperAdmin: isSuperAdminRequest(req),
  };
}

async function syncAccountSession(req, usuario) {
  req.session.user = buildSessionUserPayload(
    usuario,
    await resolvePermissionsForUserId(usuario._id, usuario.perfil)
  );

  return req.session.user;
}

module.exports = {
  getCurrentProfile,
  getCurrentUserId,
  isAdminRequest,
  isSuperAdminRequest,
  loadCurrentAccountContext,
  syncAccountSession,
};
