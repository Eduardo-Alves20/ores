const { registrarAuditoria } = require("../../services/auditService");
const {
  buildAdministrationPageView,
  changeAdministrationCustomFieldStatus,
  changeAdministrationPresenceReasonStatus,
  changeAdministrationQuickFilterStatus,
  getAdministrationActorId,
  loadAdministrationPageContext,
  saveAdministrationCustomField,
  saveAdministrationPresenceReason,
  saveAdministrationQuickFilter,
} = require("../../services/admin/administration/administrationPageService");

function renderAdministrationPageError(res, logMessage, publicMessage, error) {
  console.error(logMessage, error);
  return res.status(500).send(publicMessage);
}

function respondAdministrationError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);
  return res.status(error?.status || 500).json({
    erro: error?.message || fallbackMessage,
  });
}

async function applyAdministrationAudit(req, result) {
  if (result?.audit) {
    await registrarAuditoria(req, result.audit);
  }
}

async function respondWithAdministrationEntity(req, res, statusCode, result, entityKey) {
  await applyAdministrationAudit(req, result);

  return res.status(statusCode).json({
    mensagem: result.mensagem,
    [entityKey]: result[entityKey],
  });
}

async function handleAdministrationAction(req, res, config) {
  try {
    return respondWithAdministrationEntity(
      req,
      res,
      config.statusCode,
      await config.action(config.buildInput(req)),
      config.entityKey
    );
  } catch (error) {
    return respondAdministrationError(
      res,
      config.logMessage,
      config.fallbackMessage,
      error
    );
  }
}

class AdministracaoController {
  static async page(req, res) {
    try {
      return res.status(200).render(
        "pages/admin/administracao",
        buildAdministrationPageView(await loadAdministrationPageContext())
      );
    } catch (error) {
      return renderAdministrationPageError(
        res,
        "Erro ao carregar central de administracao:",
        "Erro ao carregar a central de administracao.",
        error
      );
    }
  }

  static async config(req, res) {
    try {
      return res.status(200).json(await loadAdministrationPageContext());
    } catch (error) {
      return respondAdministrationError(
        res,
        "Erro ao carregar configuracoes administrativas:",
        "Erro interno ao carregar configuracoes.",
        error
      );
    }
  }

  static async criarJustificativa(req, res) {
    return handleAdministrationAction(req, res, {
      action: saveAdministrationPresenceReason,
      buildInput: (request) => ({
        body: request.body || {},
        actorId: getAdministrationActorId(request),
      }),
      entityKey: "justificativa",
      statusCode: 201,
      logMessage: "Erro ao criar justificativa de presenca:",
      fallbackMessage: "Erro interno ao criar justificativa.",
    });
  }

  static async atualizarJustificativa(req, res) {
    return handleAdministrationAction(req, res, {
      action: saveAdministrationPresenceReason,
      buildInput: (request) => ({
        body: request.body || {},
        actorId: getAdministrationActorId(request),
        id: request.params?.id,
      }),
      entityKey: "justificativa",
      statusCode: 200,
      logMessage: "Erro ao atualizar justificativa de presenca:",
      fallbackMessage: "Erro interno ao atualizar justificativa.",
    });
  }

  static async alterarStatusJustificativa(req, res) {
    return handleAdministrationAction(req, res, {
      action: changeAdministrationPresenceReasonStatus,
      buildInput: (request) => ({
        id: request.params?.id,
        ativoInput: request.body?.ativo,
        actorId: getAdministrationActorId(request),
      }),
      entityKey: "justificativa",
      statusCode: 200,
      logMessage: "Erro ao alterar status da justificativa de presenca:",
      fallbackMessage: "Erro interno ao alterar justificativa.",
    });
  }

  static async criarCampo(req, res) {
    return handleAdministrationAction(req, res, {
      action: saveAdministrationCustomField,
      buildInput: (request) => ({
        body: request.body || {},
        actorId: getAdministrationActorId(request),
      }),
      entityKey: "campo",
      statusCode: 201,
      logMessage: "Erro ao criar campo extra:",
      fallbackMessage: "Erro interno ao criar campo extra.",
    });
  }

  static async atualizarCampo(req, res) {
    return handleAdministrationAction(req, res, {
      action: saveAdministrationCustomField,
      buildInput: (request) => ({
        body: request.body || {},
        actorId: getAdministrationActorId(request),
        id: request.params?.id,
      }),
      entityKey: "campo",
      statusCode: 200,
      logMessage: "Erro ao atualizar campo extra:",
      fallbackMessage: "Erro interno ao atualizar campo extra.",
    });
  }

  static async alterarStatusCampo(req, res) {
    return handleAdministrationAction(req, res, {
      action: changeAdministrationCustomFieldStatus,
      buildInput: (request) => ({
        id: request.params?.id,
        ativoInput: request.body?.ativo,
        actorId: getAdministrationActorId(request),
      }),
      entityKey: "campo",
      statusCode: 200,
      logMessage: "Erro ao alterar status do campo extra:",
      fallbackMessage: "Erro interno ao alterar campo extra.",
    });
  }

  static async criarFiltro(req, res) {
    return handleAdministrationAction(req, res, {
      action: saveAdministrationQuickFilter,
      buildInput: (request) => ({
        body: request.body || {},
        actorId: getAdministrationActorId(request),
      }),
      entityKey: "filtro",
      statusCode: 201,
      logMessage: "Erro ao criar filtro rapido:",
      fallbackMessage: "Erro interno ao criar filtro rapido.",
    });
  }

  static async atualizarFiltro(req, res) {
    return handleAdministrationAction(req, res, {
      action: saveAdministrationQuickFilter,
      buildInput: (request) => ({
        body: request.body || {},
        actorId: getAdministrationActorId(request),
        id: request.params?.id,
      }),
      entityKey: "filtro",
      statusCode: 200,
      logMessage: "Erro ao atualizar filtro rapido:",
      fallbackMessage: "Erro interno ao atualizar filtro rapido.",
    });
  }

  static async alterarStatusFiltro(req, res) {
    return handleAdministrationAction(req, res, {
      action: changeAdministrationQuickFilterStatus,
      buildInput: (request) => ({
        id: request.params?.id,
        ativoInput: request.body?.ativo,
        actorId: getAdministrationActorId(request),
      }),
      entityKey: "filtro",
      statusCode: 200,
      logMessage: "Erro ao alterar status do filtro rapido:",
      fallbackMessage: "Erro interno ao alterar filtro rapido.",
    });
  }
}

module.exports = AdministracaoController;
