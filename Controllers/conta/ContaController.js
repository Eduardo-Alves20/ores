const { registrarAuditoria } = require("../../services/auditService");
const {
  buildEditPerfilViewModel,
  buildNotificationsPageView,
  buildPerfilViewModel,
  changeOwnPassword,
  loadCurrentAccountContext,
  syncAccountSession,
  updateOwnProfile,
} = require("../../services/conta/contaPageService");
const { logSanitizedError } = require("../../services/security/logSanitizerService");

function renderContaPageError(req, res, logMessage, publicMessage, error) {
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

function redirectWithFlash(req, res, flashKey, message, redirectTo) {
  req.flash(flashKey, message);
  return res.redirect(redirectTo);
}

async function loadContextOrRedirect(req, res) {
  const context = await loadCurrentAccountContext(req);
  if (context?.redirectTo) {
    res.redirect(context.redirectTo);
    return null;
  }
  return context;
}

function handleProfileMutationError(req, res, logMessage, error, fallbackRedirect, fallbackFlashKey) {
  logSanitizedError(logMessage, error, {
    route: req?.originalUrl || req?.url || "",
    userId: req?.session?.user?.id || null,
  });

  if (error?.code === 11000) {
    return redirectWithFlash(
      req,
      res,
      fallbackFlashKey,
      "Email, usuario de login ou CPF ja cadastrado.",
      fallbackRedirect
    );
  }

  return redirectWithFlash(
    req,
    res,
    error?.flashKey || fallbackFlashKey,
    error?.message || "Nao foi possivel concluir a operacao.",
    error?.redirectTo || fallbackRedirect
  );
}

class ContaController {
  static async perfil(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      return res.status(200).render(
        "pages/conta/perfil",
        buildPerfilViewModel(context.usuario, {
          success: req.flash("success"),
          error: req.flash("error"),
          senhaError: req.flash("senhaError"),
          senhaQuery: req.query?.senha,
        })
      );
    } catch (error) {
      return renderContaPageError(
        req,
        res,
        "Erro ao carregar perfil:",
        "Erro ao carregar perfil.",
        error
      );
    }
  }

  static async editarPerfilPage(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      return res.status(200).render(
        "pages/conta/perfil-editar",
        buildEditPerfilViewModel({
          usuario: context.usuario,
          isAdmin: context.isAdmin,
          isSuperAdmin: context.isSuperAdmin,
          successMessage: req.flash("success"),
          errorMessage: req.flash("error"),
        })
      );
    } catch (error) {
      return renderContaPageError(
        req,
        res,
        "Erro ao carregar perfil:",
        "Erro ao carregar formulario de perfil.",
        error
      );
    }
  }

  static async editarPerfil(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      const usuario = await updateOwnProfile({
        userId: context.userId,
        body: req.body || {},
        isAdmin: context.isAdmin,
        isSuperAdmin: context.isSuperAdmin,
      });

      await syncAccountSession(req, usuario);

      await registrarAuditoria(req, {
        acao: "PERFIL_ATUALIZADO",
        entidade: "usuario",
        entidadeId: String(usuario._id),
      });

      req.flash("success", "Perfil atualizado com sucesso.");
      return res.redirect("/perfil");
    } catch (error) {
      return handleProfileMutationError(
        req,
        res,
        "Erro ao atualizar perfil:",
        error,
        "/perfil/editar",
        "error"
      );
    }
  }

  static async alterarSenha(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      await changeOwnPassword({
        userId: context.userId,
        body: req.body || {},
      });

      await registrarAuditoria(req, {
        acao: "PERFIL_SENHA_ATUALIZADA",
        entidade: "usuario",
        entidadeId: String(context.userId),
      });

      req.session.destroy(() => {
        res.clearCookie(process.env.SESSION_NAME || "alento.sid");
        res.clearCookie("connect.sid");
        return res.redirect("/login?reason=senha_alterada");
      });
      return null;
    } catch (error) {
      return handleProfileMutationError(
        req,
        res,
        "Erro ao alterar senha do perfil:",
        error,
        "/perfil?senha=1",
        "senhaError"
      );
    }
  }

  static async notificacoes(req, res) {
    try {
      const context = await loadContextOrRedirect(req, res);
      if (!context) return null;

      if (
        String(context?.profile || "").trim().toLowerCase() === "usuario" &&
        String(context?.usuario?.tipoCadastro || "").trim().toLowerCase() === "familia"
      ) {
        return res.redirect("/minha-familia/notificacoes");
      }

      return res.status(200).render(
        "pages/conta/notificacoes",
        await buildNotificationsPageView({
          userId: context.userId,
          profile: context.profile,
          query: req.query || {},
        })
      );
    } catch (error) {
      return renderContaPageError(
        req,
        res,
        "Erro ao carregar notificacoes:",
        "Erro ao carregar notificacoes.",
        error
      );
    }
  }
}

module.exports = ContaController;
