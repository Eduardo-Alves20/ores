const { registrarAuditoria } = require("../../services/shared/auditService");
const {
  changeFamilyStatus,
  createFamily,
  getActorId,
  getSessionUser,
  listFamilies,
  loadFamilyDetail,
  openFamilyAttachment,
  uploadFamilyAttachments,
  updateFamily,
} = require("../../services/familia/familiaApiService");
const { lookupAddressByCep } = require("../../services/shared/cepLookupService");

function respondFamiliaError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);
  return res.status(error?.status || 500).json({
    erro: error?.message || fallbackMessage,
  });
}

function respondFamiliaNotFound(res) {
  return res.status(404).json({
    erro: "Assistido nao encontrado.",
  });
}

async function respondWithAuditedFamily(req, res, statusCode, result) {
  if (!result?.familia) {
    return respondFamiliaNotFound(res);
  }

  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }

  const familia = result?.familia?.toObject
    ? result.familia.toObject({ flattenMaps: true })
    : result.familia;

  return res.status(statusCode).json({
    mensagem: result.mensagem,
    familia,
  });
}

class FamiliaController {
  static async buscarCep(req, res) {
    try {
      const payload = await lookupAddressByCep(req.params?.cep);
      return res.status(200).json(payload);
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao consultar CEP:",
        "Erro interno ao consultar CEP.",
        error
      );
    }
  }

  static async listar(req, res) {
    try {
      return res.status(200).json(
        await listFamilies({
          user: getSessionUser(req),
          query: req.query || {},
        })
      );
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao listar assistidos:",
        "Erro interno ao listar assistidos.",
        error
      );
    }
  }

  static async detalhar(req, res) {
    try {
      const payload = await loadFamilyDetail({
        id: req.params?.id,
        user: getSessionUser(req),
        actorId: getActorId(req),
        query: req.query || {},
      });

      if (!payload) {
        return respondFamiliaNotFound(res);
      }

      return res.status(200).json(payload);
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao detalhar assistido:",
        "Erro interno ao detalhar assistido.",
        error
      );
    }
  }

  static async criar(req, res) {
    try {
      return respondWithAuditedFamily(
        req,
        res,
        201,
        await createFamily({
          actorId: getActorId(req),
          body: req.body || {},
        })
      );
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao criar assistido:",
        "Erro interno ao criar assistido.",
        error
      );
    }
  }

  static async atualizar(req, res) {
    try {
      return respondWithAuditedFamily(
        req,
        res,
        200,
        await updateFamily({
          id: req.params?.id,
          user: getSessionUser(req),
          actorId: getActorId(req),
          body: req.body || {},
        })
      );
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao atualizar assistido:",
        "Erro interno ao atualizar assistido.",
        error
      );
    }
  }

  static async alterarStatus(req, res) {
    try {
      return respondWithAuditedFamily(
        req,
        res,
        200,
        await changeFamilyStatus({
          id: req.params?.id,
          user: getSessionUser(req),
          actorId: getActorId(req),
          ativoInput: req.body?.ativo,
        })
      );
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao alterar status do assistido:",
        "Erro interno ao alterar status do assistido.",
        error
      );
    }
  }

  static async uploadAnexos(req, res) {
    try {
      const result = await uploadFamilyAttachments({
        id: req.params?.id,
        user: getSessionUser(req),
        actorId: getActorId(req),
        files: req.files || [],
      });

      if (!result?.familia) {
        return respondFamiliaNotFound(res);
      }

      if (result.audit) {
        await registrarAuditoria(req, result.audit);
      }

      return res.status(200).json({
        mensagem: result.mensagem,
        total: result.total || 0,
        anexos: result.anexos || [],
      });
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao enviar anexos do assistido:",
        "Erro interno ao enviar anexos do assistido.",
        error
      );
    }
  }

  static async visualizarAnexo(req, res) {
    try {
      const payload = await openFamilyAttachment({
        id: req.params?.id,
        attachmentId: req.params?.attachmentId,
        user: getSessionUser(req),
      });

      const attachment = payload?.attachment || {};
      const fileName = String(attachment.originalName || "anexo").replace(/["\r\n]/g, "");
      const mimeType = String(attachment.mimeType || "application/octet-stream");
      const isPreviewable = mimeType.startsWith("image/") || mimeType === "application/pdf";

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", String(payload?.buffer?.length || 0));
      res.setHeader(
        "Content-Disposition",
        `${isPreviewable ? "inline" : "attachment"}; filename="${fileName}"`
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(payload.buffer);
    } catch (error) {
      return respondFamiliaError(
        res,
        "Erro ao exibir anexo do assistido:",
        "Erro interno ao exibir anexo do assistido.",
        error
      );
    }
  }
}

module.exports = FamiliaController;
