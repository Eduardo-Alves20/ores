const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { canMutateEvent } = require("./agendaPermissionService");
const { createAgendaError, ensureAgendaObjectId } = require("./agendaErrorService");
const { mapEvento } = require("./agendaMappingService");
const { loadEventoById } = require("./agendaRelationService");
const {
  PERMISSIONS,
  ensureAgendaPermission,
} = require("./agendaEventMutationSupportService");

async function deleteAgendaEvent(user, eventId) {
  ensureAgendaPermission(
    user,
    [PERMISSIONS.AGENDA_STATUS, PERMISSIONS.AGENDA_MEDICO_MANAGE],
    "Acesso negado para agenda."
  );

  const normalizedEventId = ensureAgendaObjectId(eventId, "Identificador de agendamento invalido.");
  const evento = await AgendaEvento.findById(normalizedEventId);
  if (!evento) {
    throw createAgendaError(404, "Evento de agenda nao encontrado.");
  }

  if (!canMutateEvent(user, evento)) {
    throw createAgendaError(403, "Sem permissao para excluir este evento.");
  }

  const loaded = await loadEventoById(evento._id);
  const snapshot = mapEvento(loaded);

  await AgendaEvento.deleteOne({ _id: evento._id });

  return {
    mensagem: "Agendamento excluido com sucesso.",
    evento: snapshot,
    audit: {
      acao: "AGENDA_EVENTO_EXCLUIDO",
      entidade: "agenda_evento",
      entidadeId: evento._id,
      detalhes: {
        titulo: evento.titulo,
        inicio: evento.inicio,
      },
    },
    notify: {
      type: "event_cancelled",
      event: loaded,
    },
  };
}

module.exports = {
  deleteAgendaEvent,
};
