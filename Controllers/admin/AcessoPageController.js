const { registrarAuditoria } = require("../../services/auditService");
const {
  approveUserAccess,
  buildApprovalQueuePageView,
  buildUserTypePageView,
  changeUserAccessStatus,
  loadApprovalDetailPayload,
  parseBoolean,
  rejectUserAccess,
  resolveReturnTo,
  voteUserApproval,
} = require("../../services/admin/acessoPageService");
const { logSanitizedError } = require("../../services/security/logSanitizerService");

const DEFAULT_APPROVAL_RETURN_TO = "/acessos/aprovacoes";

function renderAccessPageError(req, res, logMessage, publicMessage, error) {
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

function redirectWithFlash(req, res, returnTo, type, message) {
  req.flash(type, message);
  return res.redirect(returnTo);
}

function handleActionError(req, res, returnTo, logMessage, fallbackMessage, error) {
  logSanitizedError(logMessage, error, {
    route: req?.originalUrl || req?.url || "",
    userId: req?.session?.user?.id || null,
    returnTo,
  });
  return redirectWithFlash(req, res, returnTo, "error", error?.message || fallbackMessage);
}

class AcessoPageController {
  static async usuariosFamilia(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "familia",
      defaultLimit: 10,
      title: "Familias",
      sectionTitle: "Familias",
      navKey: "usuarios-familia",
      subtitle: "Familiares cadastrados para eventual acesso ao sistema.",
      basePath: "/acessos/familias",
    });
  }

  static async usuariosVoluntario(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "voluntario",
      showAllUsers: true,
      defaultLimit: 10,
      title: "Voluntarios",
      sectionTitle: "Voluntarios",
      navKey: "usuarios-voluntario",
      subtitle: "Todos os acessos do sistema, inclusive portal, equipe interna e administradores.",
      basePath: "/acessos/voluntarios",
    });
  }

  static async listarPorTipo(req, res, config) {
    try {
      const viewModel = await buildUserTypePageView(req, config);

      return res.status(200).render("pages/acessos/lista-tipo", {
        ...viewModel,
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      return renderAccessPageError(
        req,
        res,
        "Erro ao carregar tela de usuarios por tipo:",
        "Erro ao carregar tela de usuarios.",
        error
      );
    }
  }

  static async aprovacoes(req, res) {
    try {
      const viewModel = await buildApprovalQueuePageView(req);

      return res.status(200).render("pages/acessos/aprovacoes", {
        ...viewModel,
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      return renderAccessPageError(
        req,
        res,
        "Erro ao carregar tela de aprovacoes:",
        "Erro ao carregar aprovacoes.",
        error
      );
    }
  }

  static async detalhe(req, res) {
    try {
      const payload = await loadApprovalDetailPayload(
        req.params?.id,
        req?.session?.user?.id || null
      );

      if (!payload) {
        return res.status(404).json({ erro: "Usuario nao encontrado." });
      }

      return res.status(200).json(payload);
    } catch (error) {
      if (error?.status === 400) {
        return res.status(400).json({
          erro: error?.publicMessage || error?.message || "Usuario invalido.",
        });
      }

      logSanitizedError("Erro ao carregar detalhe de aprovacao:", error, {
        route: req?.originalUrl || req?.url || "",
        userId: req?.session?.user?.id || null,
      });
      return res.status(500).json({ erro: "Erro ao carregar a ficha de aprovacao." });
    }
  }

  static async aprovar(req, res) {
    const returnTo = resolveReturnTo(req.body?.returnTo, DEFAULT_APPROVAL_RETURN_TO);

    try {
      const result = await approveUserAccess({
        id: req.params?.id,
        actorId: req?.session?.user?.id || null,
        body: req.body || {},
      });

      await registrarAuditoria(req, result.audit);
      return redirectWithFlash(req, res, returnTo, "success", result.successMessage);
    } catch (error) {
      return handleActionError(
        req,
        res,
        returnTo,
        "Erro ao aprovar usuario:",
        "Erro ao aprovar cadastro.",
        error
      );
    }
  }

  static async rejeitar(req, res) {
    const returnTo = resolveReturnTo(req.body?.returnTo, DEFAULT_APPROVAL_RETURN_TO);

    try {
      const result = await rejectUserAccess({
        id: req.params?.id,
        actorId: req?.session?.user?.id || null,
        motivo: String(req.body?.motivo || "").trim(),
      });

      await registrarAuditoria(req, result.audit);
      return redirectWithFlash(req, res, returnTo, "success", result.successMessage);
    } catch (error) {
      return handleActionError(
        req,
        res,
        returnTo,
        "Erro ao rejeitar usuario:",
        "Erro ao rejeitar cadastro.",
        error
      );
    }
  }

  static async alterarStatus(req, res) {
    const returnTo = resolveReturnTo(req.body?.returnTo, DEFAULT_APPROVAL_RETURN_TO);

    try {
      const result = await changeUserAccessStatus({
        req,
        id: req.params?.id,
        actorId: req?.session?.user?.id || null,
        ativo: parseBoolean(req.body?.ativo),
      });

      await registrarAuditoria(req, result.audit);
      return redirectWithFlash(req, res, returnTo, "success", result.successMessage);
    } catch (error) {
      return handleActionError(
        req,
        res,
        returnTo,
        "Erro ao alterar status de usuario:",
        "Erro ao alterar status do usuario.",
        error
      );
    }
  }

  static async votar(req, res) {
    const returnTo = resolveReturnTo(req.body?.returnTo, DEFAULT_APPROVAL_RETURN_TO);

    try {
      const result = await voteUserApproval({
        id: req.params?.id,
        actorId: req?.session?.user?.id || null,
        decisao: req.body?.decisao,
        motivo: String(req.body?.motivo || "").trim(),
        nivelAcessoVoluntarioInput: req.body?.nivelAcessoVoluntario,
      });

      await registrarAuditoria(req, result.audit);
      return redirectWithFlash(req, res, returnTo, "success", result.successMessage);
    } catch (error) {
      return handleActionError(
        req,
        res,
        returnTo,
        "Erro ao votar em cadastro:",
        "Erro ao registrar voto.",
        error
      );
    }
  }
}

module.exports = AcessoPageController;
