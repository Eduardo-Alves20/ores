const {
  buildPortalFamilyConsultasPageView,
  buildPortalFamilyHomePageView,
  buildPortalFamilyNotificacoesPageView,
  loadPortalFamilyAgendaMonthData,
  loadPortalFamilyContext,
  markAllPortalFamilyNotificationsAsRead,
  markPortalFamilyNotificationAsRead,
  registerFamilyAbsence,
  requestFamilyReschedule,
} = require("../../services/portal/portalFamiliaPageService");

function renderPortalPageError(req, res, logMessage, publicMessage, error) {
  console.error(logMessage, error);
  return res.status(500).render("pages/errors/500", {
    status: 500,
    message: publicMessage,
    req,
    err: error,
    layout: "partials/login.ejs",
  });
}

async function loadContextOrRedirect(req, res) {
  const context = await loadPortalFamilyContext(req?.session?.user);
  if (context?.redirectTo) {
    res.redirect(context.redirectTo);
    return null;
  }
  return context;
}

function resolveReturnUrl(req) {
  const referer = String(req?.get?.("referer") || "").trim();
  if (referer) return referer;
  return "/minha-familia/notificacoes";
}

async function loadContextOrJsonError(req, res) {
  const context = await loadPortalFamilyContext(req?.session?.user);
  if (!context?.redirectTo) return context;

  const status = context.redirectTo === "/login" ? 401 : 403;
  res.status(status).json({
    erro: "Acesso indisponivel para esta agenda.",
  });
  return null;
}

class PortalFamiliaController {
  static async inicio(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      return res
        .status(200)
        .render("pages/usuario/minha-familia", await buildPortalFamilyHomePageView(context));
    } catch (error) {
      return renderPortalPageError(
        req,
        res,
        "Erro ao carregar portal da familia:",
        "Erro ao carregar os dados da sua familia.",
        error
      );
    }
  }

  static async consultas(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      return res.status(200).render(
        "pages/usuario/minha-familia-consultas",
        await buildPortalFamilyConsultasPageView(context, req.query || {})
      );
    } catch (error) {
      return renderPortalPageError(
        req,
        res,
        "Erro ao carregar consultas da familia:",
        "Erro ao carregar as consultas da sua familia.",
        error
      );
    }
  }

  static async notificacoes(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      return res.status(200).render(
        "pages/usuario/minha-familia-notificacoes",
        await buildPortalFamilyNotificacoesPageView(context, req.query || {})
      );
    } catch (error) {
      return renderPortalPageError(
        req,
        res,
        "Erro ao carregar notificacoes da familia:",
        "Erro ao carregar as notificacoes da sua familia.",
        error
      );
    }
  }

  static async consultasEventos(req, res) {
    try {
      const context = await loadContextOrJsonError(req, res);
      if (!context) return null;

      return res.status(200).json(
        await loadPortalFamilyAgendaMonthData({
          familiaId: context?.familia?._id || null,
          query: req.query || {},
        })
      );
    } catch (error) {
      console.error("Erro ao listar agenda da familia:", error);
      return res.status(error?.status || 500).json({
        erro: error?.publicMessage || "Erro ao carregar a agenda da familia.",
      });
    }
  }

  static async registrarFalta(req, res) {
    try {
      const context = await loadContextOrJsonError(req, res);
      if (!context) return null;

      const result = await registerFamilyAbsence(
        context,
        req.params?.id,
        req.body || {}
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("Erro ao registrar falta pela familia:", error);
      return res.status(error?.status || 500).json({
        erro: error?.publicMessage || "Erro ao registrar falta da familia.",
      });
    }
  }

  static async solicitarRemarcacao(req, res) {
    try {
      const context = await loadContextOrJsonError(req, res);
      if (!context) return null;

      const result = await requestFamilyReschedule(
        context,
        req.params?.id,
        req.body || {}
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("Erro ao solicitar remarcacao pela familia:", error);
      return res.status(error?.status || 500).json({
        erro: error?.publicMessage || "Erro ao solicitar remarcacao.",
      });
    }
  }

  static async marcarNotificacaoLida(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      await markPortalFamilyNotificationAsRead({
        userId: context.userId,
        notificationId: req.params?.id,
      });

      return res.redirect(resolveReturnUrl(req));
    } catch (error) {
      return renderPortalPageError(
        req,
        res,
        "Erro ao marcar notificacao da familia como lida:",
        "Erro ao atualizar a notificacao.",
        error
      );
    }
  }

  static async marcarTodasNotificacoesLidas(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      await markAllPortalFamilyNotificationsAsRead(context.userId);
      return res.redirect("/minha-familia/notificacoes");
    } catch (error) {
      return renderPortalPageError(
        req,
        res,
        "Erro ao marcar notificacoes da familia como lidas:",
        "Erro ao atualizar as notificacoes.",
        error
      );
    }
  }
}

module.exports = PortalFamiliaController;
