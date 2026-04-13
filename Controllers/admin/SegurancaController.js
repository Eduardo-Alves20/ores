const { registrarAuditoria } = require("../../services/shared/auditService");
const { refreshSessionPermissions } = require("../../services/shared/accessControlService");
const {
  assignSecurityRolesToUser,
  buildSecurityAccessPageView,
  changeSecurityRoleStatus,
  createSecurityRole,
  getSecurityActorId,
  updateSecurityRole,
} = require("../../services/admin/security/securityPageService");

function renderSecurityPageError(req, res, logMessage, publicMessage, error) {
  console.error(logMessage, error);
  return res.status(500).render("pages/errors/500", {
    status: 500,
    message: publicMessage,
    req,
    err: error,
    layout: "partials/login.ejs",
  });
}

function redirectWithFlash(req, res, type, message, redirectTo) {
  req.flash(type, message);
  return res.redirect(redirectTo);
}

function handleSecurityActionError(req, res, logMessage, error, fallbackRedirect) {
  console.error(logMessage, error);

  if (error?.code === 11000) {
    return redirectWithFlash(
      req,
      res,
      "error",
      "Ja existe uma funcao com esse slug.",
      error?.redirectTo || fallbackRedirect
    );
  }

  return redirectWithFlash(
    req,
    res,
    "error",
    error?.message || "Nao foi possivel concluir a operacao.",
    error?.redirectTo || fallbackRedirect
  );
}

async function applySecurityResult(req, result) {
  if (!result) return;
  if (result.refreshUserId) {
    await refreshSessionPermissions(req, result.refreshUserId);
  }
  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }
}

class SegurancaController {
  static async index(req, res) {
    try {
      return res.status(200).render(
        "pages/seguranca/funcoes",
        await buildSecurityAccessPageView(req.query || {}, {
          success: req.flash("success"),
          error: req.flash("error"),
        })
      );
    } catch (error) {
      return renderSecurityPageError(
        req,
        res,
        "Erro ao carregar seguranca de funcoes:",
        "Erro ao carregar a seguranca de acesso.",
        error
      );
    }
  }

  static async criarFuncao(req, res) {
    try {
      const result = await createSecurityRole({
        actorId: getSecurityActorId(req),
        body: req.body || {},
      });

      await applySecurityResult(req, result);
      return redirectWithFlash(req, res, "success", result.successMessage, result.redirectTo);
    } catch (error) {
      return handleSecurityActionError(
        req,
        res,
        "Erro ao criar funcao:",
        error,
        "/seguranca/funcoes"
      );
    }
  }

  static async atualizarFuncao(req, res) {
    try {
      const result = await updateSecurityRole({
        actorId: getSecurityActorId(req),
        id: req.params?.id,
        body: req.body || {},
      });

      await applySecurityResult(req, result);
      return redirectWithFlash(req, res, "success", result.successMessage, result.redirectTo);
    } catch (error) {
      return handleSecurityActionError(
        req,
        res,
        "Erro ao atualizar funcao:",
        error,
        "/seguranca/funcoes"
      );
    }
  }

  static async alterarStatusFuncao(req, res) {
    try {
      const result = await changeSecurityRoleStatus({
        actorId: getSecurityActorId(req),
        id: req.params?.id,
        ativoInput: req.body?.ativo,
        returnTo: req.body?.returnTo,
      });

      await applySecurityResult(req, result);
      return redirectWithFlash(req, res, "success", result.successMessage, result.redirectTo);
    } catch (error) {
      return handleSecurityActionError(
        req,
        res,
        "Erro ao alterar status da funcao:",
        error,
        "/seguranca/funcoes"
      );
    }
  }

  static async atribuirFuncoes(req, res) {
    try {
      const result = await assignSecurityRolesToUser({
        actorId: getSecurityActorId(req),
        usuarioId: req.params?.id,
        body: req.body || {},
      });

      await applySecurityResult(req, result);
      return redirectWithFlash(req, res, "success", result.successMessage, result.redirectTo);
    } catch (error) {
      return handleSecurityActionError(
        req,
        res,
        "Erro ao atribuir funcoes:",
        error,
        "/seguranca/funcoes"
      );
    }
  }
}

module.exports = SegurancaController;
