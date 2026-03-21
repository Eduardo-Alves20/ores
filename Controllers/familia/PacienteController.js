const { registrarAuditoria } = require("../../services/auditService");
const {
  changePatientStatus,
  createPatient,
  getActorId,
  getSessionUser,
  listPatientsByFamily,
  updatePatient,
} = require("../../services/familia/pacienteApiService");

function respondPacienteError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);
  return res.status(error?.status || 500).json({
    erro: error?.message || fallbackMessage,
  });
}

function respondPacienteNotFound(res) {
  return res.status(404).json({
    erro: "Paciente nao encontrado.",
  });
}

async function respondWithAuditedPatient(req, res, statusCode, result) {
  if (!result?.paciente) {
    return respondPacienteNotFound(res);
  }

  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }

  return res.status(statusCode).json({
    mensagem: result.mensagem,
    paciente: result.paciente,
  });
}

class PacienteController {
  static async listarPorFamilia(req, res) {
    try {
      return res.status(200).json(
        await listPatientsByFamily({
          user: getSessionUser(req),
          familiaId: req.params?.familiaId,
          query: req.query || {},
        })
      );
    } catch (error) {
      return respondPacienteError(
        res,
        "Erro ao listar pacientes:",
        "Erro interno ao listar pacientes.",
        error
      );
    }
  }

  static async criar(req, res) {
    try {
      return respondWithAuditedPatient(
        req,
        res,
        201,
        await createPatient({
          user: getSessionUser(req),
          actorId: getActorId(req),
          familiaId: req.params?.familiaId,
          body: req.body || {},
        })
      );
    } catch (error) {
      return respondPacienteError(
        res,
        "Erro ao criar paciente:",
        "Erro interno ao criar paciente.",
        error
      );
    }
  }

  static async atualizar(req, res) {
    try {
      return respondWithAuditedPatient(
        req,
        res,
        200,
        await updatePatient({
          user: getSessionUser(req),
          actorId: getActorId(req),
          id: req.params?.id,
          body: req.body || {},
        })
      );
    } catch (error) {
      return respondPacienteError(
        res,
        "Erro ao atualizar paciente:",
        "Erro interno ao atualizar paciente.",
        error
      );
    }
  }

  static async alterarStatus(req, res) {
    try {
      return respondWithAuditedPatient(
        req,
        res,
        200,
        await changePatientStatus({
          user: getSessionUser(req),
          actorId: getActorId(req),
          id: req.params?.id,
          ativoInput: req.body?.ativo,
        })
      );
    } catch (error) {
      return respondPacienteError(
        res,
        "Erro ao alterar status do paciente:",
        "Erro interno ao alterar status do paciente.",
        error
      );
    }
  }
}

module.exports = PacienteController;
