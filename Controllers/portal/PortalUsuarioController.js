const {
  buildPortalProfilePageView,
  loadPortalUserContext,
} = require("../../services/portal/portalUsuarioPageService");
const { logSanitizedError } = require("../../services/security/logSanitizerService");

function renderPortalPageError(req, res, logMessage, publicMessage, error) {
  logSanitizedError(logMessage, error, {
    route: req?.originalUrl || req?.url || "",
    userId: req?.session?.user?.id || null,
  });
  return res.status(500).render("pages/errors/500", {
    status: 500,
    message: publicMessage,
    req,
    err: error,
    layout: "partials/login.ejs",
  });
}

async function loadContextOrRedirect(req, res) {
  const context = await loadPortalUserContext(req?.session?.user);
  if (context?.redirectTo) {
    res.redirect(context.redirectTo);
    return null;
  }
  return context;
}

class PortalUsuarioController {
  static async meusDados(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      return res
        .status(200)
        .render("pages/usuario/meus-dados", buildPortalProfilePageView(context));
    } catch (error) {
      return renderPortalPageError(
        req,
        res,
        "Erro ao carregar meus dados:",
        "Erro ao carregar seus dados.",
        error
      );
    }
  }

}

module.exports = PortalUsuarioController;
