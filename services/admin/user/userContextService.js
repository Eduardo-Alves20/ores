const { PERFIS } = require("../../../config/roles");
const UsuarioService = require("../../domain/UsuarioService");

function createUserAdminError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getCurrentProfile(req) {
  return String(req?.session?.user?.perfil || "").trim().toLowerCase();
}

function getActorContext(req) {
  return {
    usuarioId: req?.session?.user?.id || null,
  };
}

function isSuperAdminProfile(profile) {
  return String(profile || "").trim().toLowerCase() === PERFIS.SUPERADMIN;
}

function isSuperAdminRequest(req) {
  return isSuperAdminProfile(getCurrentProfile(req));
}

async function ensureManageableTarget({ currentProfile, id }) {
  const usuario = await UsuarioService.buscarPorId(id);
  if (!usuario) return null;

  if (
    String(usuario.perfil || "").toLowerCase() === PERFIS.SUPERADMIN &&
    !isSuperAdminProfile(currentProfile)
  ) {
    throw createUserAdminError("Somente superadmin pode alterar outro superadmin.", 403);
  }

  return usuario;
}

module.exports = {
  createUserAdminError,
  ensureManageableTarget,
  getActorContext,
  getCurrentProfile,
  isSuperAdminProfile,
  isSuperAdminRequest,
};
