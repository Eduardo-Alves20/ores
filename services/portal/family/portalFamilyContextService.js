const { Paciente } = require("../../../schemas/social/Paciente");
const UsuarioService = require("../../domain/UsuarioService");
const { PERFIS } = require("../../../config/roles");
const { findLinkedFamily } = require("../user/portalUserFamilyService");
const { mapDependenteCard } = require("./portalFamilyFormattingService");
const { loadPortalFamilyNotificationSummary } = require("./portalFamilyNotificationService");
const { isFamilyPortalUser } = require("./portalFamilyPolicyService");

async function loadPortalFamilyContext(sessionUser = null) {
  const userId = sessionUser?.id || null;
  const perfil = String(sessionUser?.perfil || "").trim().toLowerCase();

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

  if (!isFamilyPortalUser(usuario)) {
    return { redirectTo: "/meus-dados" };
  }

  const familia = await findLinkedFamily(usuario);
  const dependentes = familia?._id
    ? await Paciente.find({ familiaId: familia._id }).sort({ nome: 1 }).lean()
    : [];
  const notificationSummary = await loadPortalFamilyNotificationSummary(userId);

  return {
    sessionUser,
    userId,
    usuario,
    familia,
    dependentes,
    dependentesCards: dependentes.map(mapDependenteCard),
    notificationSummary,
  };
}

module.exports = {
  loadPortalFamilyContext,
};
