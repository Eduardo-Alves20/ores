const { registrarAuditoria } = require("../../services/shared/auditService");
const {
  changeAttendanceStatus,
  createAttendance,
  getActorId,
  getSessionUser,
  listAttendancesByFamily,
  updateAttendance,
} = require("../../services/familia/atendimentoApiService");

function respondAtendimentoError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);
  return res.status(error?.status || 500).json({
    erro: error?.message || fallbackMessage,
  });
}

function respondAtendimentoNotFound(res) {
  return res.status(404).json({
    erro: "Atendimento nao encontrado.",
  });
}

async function respondWithAuditedAttendance(req, res, statusCode, result) {
  if (!result?.atendimento) {
    return respondAtendimentoNotFound(res);
  }

  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }

  return res.status(statusCode).json({
    mensagem: result.mensagem,
    atendimento: result.atendimento,
  });
}

class AtendimentoController {
  static async listarPorFamilia(req, res) {
    try {
      return res.status(200).json(
        await listAttendancesByFamily({
          user: getSessionUser(req),
          familiaId: req.params?.familiaId,
          query: req.query || {},
        })
      );
    } catch (error) {
      return respondAtendimentoError(
        res,
        "Erro ao listar atendimentos:",
        "Erro interno ao listar atendimentos.",
        error
      );
    }
  }

  static async criar(req, res) {
    try {
      return respondWithAuditedAttendance(
        req,
        res,
        201,
        await createAttendance({
          user: getSessionUser(req),
          actorId: getActorId(req),
          familiaId: req.params?.familiaId,
          body: req.body || {},
        })
      );
    } catch (error) {
      return respondAtendimentoError(
        res,
        "Erro ao criar atendimento:",
        "Erro interno ao criar atendimento.",
        error
      );
    }
  }

  static async atualizar(req, res) {
    try {
      return respondWithAuditedAttendance(
        req,
        res,
        200,
        await updateAttendance({
          user: getSessionUser(req),
          actorId: getActorId(req),
          id: req.params?.id,
          body: req.body || {},
        })
      );
    } catch (error) {
      return respondAtendimentoError(
        res,
        "Erro ao atualizar atendimento:",
        "Erro interno ao atualizar atendimento.",
        error
      );
    }
  }

  static async alterarStatus(req, res) {
    try {
      return respondWithAuditedAttendance(
        req,
        res,
        200,
        await changeAttendanceStatus({
          user: getSessionUser(req),
          actorId: getActorId(req),
          id: req.params?.id,
          ativoInput: req.body?.ativo,
        })
      );
    } catch (error) {
      return respondAtendimentoError(
        res,
        "Erro ao alterar status do atendimento:",
        "Erro interno ao alterar status do atendimento.",
        error
      );
    }
  }
}

module.exports = AtendimentoController;
