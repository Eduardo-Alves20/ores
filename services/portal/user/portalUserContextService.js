const UsuarioService = require("../../domain/UsuarioService");
const { PERFIS } = require("../../../config/roles");

async function loadPortalUserContext(sessionUser = null) {
  const userId = sessionUser?.id || null;
  const perfil = sessionUser?.perfil || "";

  if (!userId) {
    return { redirectTo: "/login" };
  }

  if (perfil !== PERFIS.USUARIO) {
    return { redirectTo: "/painel" };
  }

  const usuario = await UsuarioService.buscarPorId(userId);
  if (!usuario) {
    return { redirectTo: "/login" };
  }

  return {
    sessionUser,
    usuario,
  };
}

module.exports = {
  loadPortalUserContext,
};
