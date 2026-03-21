const { getProfileLabel } = require("../../../config/roles");
const { getVolunteerAccessLabel } = require("../../../config/volunteerAccess");
const {
  buildAccessHighlights,
  buildPortalQuickLinks,
} = require("./portalUserAccessService");
const { mapTipoCadastroLabel } = require("./portalUserFormattingService");

function buildPortalProfilePageView(context = {}) {
  const sessionUser = context?.sessionUser || null;
  const usuario = context?.usuario || null;

  return {
    title: "Meus Dados",
    sectionTitle: "Meus Dados",
    navKey: "meus-dados",
    layout: "partials/app.ejs",
    pageClass: "page-usuario-meus-dados",
    extraCss: ["/css/usuario-portal.css"],
    usuario,
    perfilLabel: getProfileLabel(usuario?.perfil),
    tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
    nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(usuario?.nivelAcessoVoluntario),
    quickLinks: buildPortalQuickLinks(sessionUser),
    accessHighlights: buildAccessHighlights(sessionUser),
  };
}

module.exports = {
  buildPortalProfilePageView,
};
