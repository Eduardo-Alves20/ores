const { registrarAuditoria } = require("../../services/shared/auditService");
const {
  changeFamilyStatus,
  createFamily,
  getActorId,
  getSessionUser,
  listFamilies,
  loadFamilyDetail,
  updateFamily,
} = require("../../services/familia/familiaApiService");

function respondFamiliaError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);
  return res.status(error?.status || 500).json({
    erro: error?.message || fallbackMessage,
  });
}

function respondFamiliaNotFound(res) {
  return res.status(404).json({
    erro: "Familia nao encontrada.",
  });
}

async function respondWithAuditedFamily(req, res, statusCode, result) {
  if (!result?.familia) {
    return respondFamiliaNotFound(res);
  }

  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }

  return res.status(statusCode).json({
    mensagem: result.mensagem,
    familia: result.familia,
  });
}

class FamiliaController {
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
        "Erro ao listar familias:",
        "Erro interno ao listar familias.",
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
        "Erro ao detalhar familia:",
        "Erro interno ao detalhar familia.",
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
        "Erro ao criar familia:",
        "Erro interno ao criar familia.",
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
        "Erro ao atualizar familia:",
        "Erro interno ao atualizar familia.",
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
        "Erro ao alterar status da familia:",
        "Erro interno ao alterar status da familia.",
        error
      );
    }
  }
}

module.exports = FamiliaController;
