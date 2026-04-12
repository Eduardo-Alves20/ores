const { parseBoolean } = require("../../../shared/valueParsingService");
const {
  savePresenceReason,
  togglePresenceReasonStatus,
  saveCustomField,
  toggleCustomFieldStatus,
  saveQuickFilter,
  toggleQuickFilterStatus,
  saveBirthdayCampaign,
  updateBirthdayCampaignStatus,
  CAMPANHA_ANIVERSARIO_STATUS_LABELS,
} = require("../../../shared/systemConfigService");

function createAdministrationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseAdministrationStatus(ativoInput) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createAdministrationError("Campo ativo e obrigatorio.", 400);
  }
  return ativo;
}

function parseBirthdayCampaignStatus(statusInput) {
  const status = String(statusInput || "").trim().toLowerCase();
  if (!status) {
    throw createAdministrationError("Campo status e obrigatorio.", 400);
  }
  if (!CAMPANHA_ANIVERSARIO_STATUS_LABELS[status]) {
    throw createAdministrationError("Status da campanha invalido.", 400);
  }
  return status;
}

async function saveAdministrationPresenceReason({ body = {}, actorId, id = null }) {
  const justificativa = await savePresenceReason(body, actorId, id);

  return {
    mensagem: id
      ? "Justificativa de presenca atualizada com sucesso."
      : "Justificativa de presenca criada com sucesso.",
    justificativa,
    audit: {
      acao: id
        ? "ADMIN_JUSTIFICATIVA_PRESENCA_ATUALIZADA"
        : "ADMIN_JUSTIFICATIVA_PRESENCA_CRIADA",
      entidade: "configuracao_sistema",
      entidadeId: justificativa._id,
    },
  };
}

async function changeAdministrationPresenceReasonStatus({ id, ativoInput, actorId }) {
  const ativo = parseAdministrationStatus(ativoInput);
  const justificativa = await togglePresenceReasonStatus(id, ativo, actorId);

  return {
    mensagem: "Status da justificativa atualizado com sucesso.",
    justificativa,
    audit: {
      acao: ativo
        ? "ADMIN_JUSTIFICATIVA_PRESENCA_REATIVADA"
        : "ADMIN_JUSTIFICATIVA_PRESENCA_INATIVADA",
      entidade: "configuracao_sistema",
      entidadeId: justificativa._id,
    },
  };
}

async function saveAdministrationCustomField({ body = {}, actorId, id = null }) {
  const campo = await saveCustomField(body, actorId, id);

  return {
    mensagem: id
      ? "Campo extra atualizado com sucesso."
      : "Campo extra criado com sucesso.",
    campo,
    audit: {
      acao: id ? "ADMIN_CAMPO_EXTRA_ATUALIZADO" : "ADMIN_CAMPO_EXTRA_CRIADO",
      entidade: "configuracao_sistema",
      entidadeId: campo._id,
    },
  };
}

async function changeAdministrationCustomFieldStatus({ id, ativoInput, actorId }) {
  const ativo = parseAdministrationStatus(ativoInput);
  const campo = await toggleCustomFieldStatus(id, ativo, actorId);

  return {
    mensagem: "Status do campo extra atualizado com sucesso.",
    campo,
    audit: {
      acao: ativo ? "ADMIN_CAMPO_EXTRA_REATIVADO" : "ADMIN_CAMPO_EXTRA_INATIVADO",
      entidade: "configuracao_sistema",
      entidadeId: campo._id,
    },
  };
}

async function saveAdministrationQuickFilter({ body = {}, actorId, id = null }) {
  const filtro = await saveQuickFilter(body, actorId, id);

  return {
    mensagem: id
      ? "Filtro rapido atualizado com sucesso."
      : "Filtro rapido criado com sucesso.",
    filtro,
    audit: {
      acao: id ? "ADMIN_FILTRO_RAPIDO_ATUALIZADO" : "ADMIN_FILTRO_RAPIDO_CRIADO",
      entidade: "configuracao_sistema",
      entidadeId: filtro._id,
    },
  };
}

async function changeAdministrationQuickFilterStatus({ id, ativoInput, actorId }) {
  const ativo = parseAdministrationStatus(ativoInput);
  const filtro = await toggleQuickFilterStatus(id, ativo, actorId);

  return {
    mensagem: "Status do filtro rapido atualizado com sucesso.",
    filtro,
    audit: {
      acao: ativo ? "ADMIN_FILTRO_RAPIDO_REATIVADO" : "ADMIN_FILTRO_RAPIDO_INATIVADO",
      entidade: "configuracao_sistema",
      entidadeId: filtro._id,
    },
  };
}

async function saveAdministrationBirthdayCampaign({ body = {}, actorId, id = null }) {
  const campanha = await saveBirthdayCampaign(body, actorId, id);

  return {
    mensagem: id
      ? "Campanha de aniversario atualizada com sucesso."
      : "Campanha de aniversario criada com sucesso.",
    campanha,
    audit: {
      acao: id ? "ADMIN_CAMPANHA_ANIVERSARIO_ATUALIZADA" : "ADMIN_CAMPANHA_ANIVERSARIO_CRIADA",
      entidade: "configuracao_sistema",
      entidadeId: campanha._id,
    },
  };
}

async function changeAdministrationBirthdayCampaignStatus({ id, statusInput, actorId }) {
  const status = parseBirthdayCampaignStatus(statusInput);
  const campanha = await updateBirthdayCampaignStatus(id, status, actorId);

  return {
    mensagem: `Campanha marcada como ${CAMPANHA_ANIVERSARIO_STATUS_LABELS[status].toLowerCase()} com sucesso.`,
    campanha,
    audit: {
      acao: `ADMIN_CAMPANHA_ANIVERSARIO_${status.toUpperCase()}`,
      entidade: "configuracao_sistema",
      entidadeId: campanha._id,
    },
  };
}

module.exports = {
  changeAdministrationBirthdayCampaignStatus,
  changeAdministrationCustomFieldStatus,
  changeAdministrationPresenceReasonStatus,
  changeAdministrationQuickFilterStatus,
  createAdministrationError,
  parseBirthdayCampaignStatus,
  parseAdministrationStatus,
  saveAdministrationBirthdayCampaign,
  saveAdministrationCustomField,
  saveAdministrationPresenceReason,
  saveAdministrationQuickFilter,
};
