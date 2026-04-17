const { registrarAuditoria } = require("../../services/shared/auditService");
const {
  approveUserAccess,
  buildApprovalQueuePageView,
  buildUserTypePageView,
  changeUserAccessStatus,
  loadProtectedApprovalAsset,
  loadApprovalDetailPayload,
  parseBoolean,
  rejectUserAccess,
  resolveReturnTo,
} = require("../../services/admin/acessoPageService");
const { logSanitizedError } = require("../../services/security/logSanitizerService");
const {
  readProtectedAssetBuffer,
} = require("../../services/security/secureVolunteerAssetService");

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

  static async visualizarAnexoProtegido(req, res) {
    try {
      const attachmentPayload = await loadProtectedApprovalAsset(
        req.params?.id,
        req.params?.kind
      );

      if (!attachmentPayload?.asset) {
        return res.status(404).json({ erro: "Anexo protegido nao encontrado." });
      }

      const { asset, buffer } = await readProtectedAssetBuffer(attachmentPayload.asset);
      const isInlinePreview =
        String(asset?.mimeType || "").startsWith("image/") ||
        String(asset?.mimeType || "") === "application/pdf";
      const safeFileName = String(asset?.originalName || "arquivo").replace(/["\r\n]/g, "");

      res.setHeader("Content-Type", asset.mimeType || "application/octet-stream");
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      res.setHeader(
        "Content-Disposition",
        `${isInlinePreview ? "inline" : "attachment"}; filename="${safeFileName}"`
      );

      return res.status(200).send(buffer);
    } catch (error) {
      if (error?.status === 400) {
        return res.status(400).json({
          erro: error?.publicMessage || error?.message || "Anexo protegido invalido.",
        });
      }

      if (error?.status === 404 || error?.code === "ENOENT") {
        return res.status(404).json({ erro: "Anexo protegido nao encontrado." });
      }

      logSanitizedError("Erro ao exibir anexo protegido de aprovacao:", error, {
        route: req?.originalUrl || req?.url || "",
        userId: req?.session?.user?.id || null,
        targetUserId: req?.params?.id || "",
      });
      return res.status(500).json({ erro: "Erro ao abrir o anexo protegido." });
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

}

module.exports = AcessoPageController;
