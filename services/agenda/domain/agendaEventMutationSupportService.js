const Usuario = require("../../../schemas/core/Usuario");
const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");
const { createAgendaError } = require("./agendaErrorService");

function ensureAgendaPermission(user, permission, message) {
  if (!user || !hasAnyPermission(user.permissions || [], [permission])) {
    throw createAgendaError(403, message);
  }
}

async function ensureActiveResponsible(responsavelId) {
  const responsavelExists = await Usuario.exists({ _id: responsavelId, ativo: true });
  if (!responsavelExists) {
    throw createAgendaError(400, "Responsavel informado esta inativo ou nao existe.");
  }
}

function buildAgendaUpdatePayload(evento, body = {}) {
  return {
    hasTitulo: Object.prototype.hasOwnProperty.call(body, "titulo"),
    hasTipoAtendimento: Object.prototype.hasOwnProperty.call(body, "tipoAtendimento"),
    hasInicio: Object.prototype.hasOwnProperty.call(body, "inicio"),
    hasFim: Object.prototype.hasOwnProperty.call(body, "fim"),
    hasFamilia: Object.prototype.hasOwnProperty.call(body, "familiaId"),
    hasPaciente: Object.prototype.hasOwnProperty.call(body, "pacienteId"),
    hasResponsavel: Object.prototype.hasOwnProperty.call(body, "responsavelId"),
    hasSala: Object.prototype.hasOwnProperty.call(body, "salaId"),
    currentInicio: evento?.inicio,
    currentFim: evento?.fim,
    currentTipoAtendimento: evento?.tipoAtendimento,
    currentFamiliaId: evento?.familiaId,
    currentPacienteId: evento?.pacienteId,
    currentSalaId: evento?.salaId,
  };
}

module.exports = {
  PERMISSIONS,
  buildAgendaUpdatePayload,
  ensureActiveResponsible,
  ensureAgendaPermission,
};
