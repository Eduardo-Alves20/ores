const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { asObjectId } = require("../../agendaAvailabilityService");
const { canMutateEvent } = require("./agendaPermissionService");
const { createAgendaError, ensureAgendaObjectId } = require("./agendaErrorService");
const { parseBoolean } = require("./agendaDateValueService");
const { mapEvento } = require("./agendaMappingService");
const { loadEventoById } = require("./agendaRelationService");
const {
  PERMISSIONS,
  ensureAgendaPermission,
} = require("./agendaEventMutationSupportService");

async function changeAgendaEventStatus(user, eventId, ativoInput) {
  ensureAgendaPermission(user, PERMISSIONS.AGENDA_STATUS, "Acesso negado para agenda.");

  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createAgendaError(400, "Campo ativo e obrigatorio.");
  }

  const normalizedEventId = ensureAgendaObjectId(eventId, "Identificador de agendamento invalido.");
  const evento = await AgendaEvento.findById(normalizedEventId);
  if (!evento) {
    throw createAgendaError(404, "Evento de agenda nao encontrado.");
  }

  if (!canMutateEvent(user, evento)) {
    throw createAgendaError(403, "Sem permissao para alterar este evento.");
  }

  const actorId = asObjectId(user.id);

  await AgendaEvento.findByIdAndUpdate(
    evento._id,
    {
      ativo,
      atualizadoPor: actorId,
      inativadoEm: ativo ? null : new Date(),
      inativadoPor: ativo ? null : actorId,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  const updated = await loadEventoById(evento._id);

  return {
    mensagem: "Status do agendamento atualizado com sucesso.",
    evento: mapEvento(updated),
    audit: {
      acao: ativo ? "AGENDA_EVENTO_REATIVADO" : "AGENDA_EVENTO_INATIVADO",
      entidade: "agenda_evento",
      entidadeId: evento._id,
    },
    history: {
      eventoId: evento._id,
      tipo: "agendamento_status_alterado",
      visibilidade: updated?.familiaId ? "todos" : "interna",
      titulo: ativo ? "Agendamento reativado" : "Agendamento inativado",
      descricao: ativo
        ? `O agendamento "${updated?.titulo || evento.titulo}" foi reativado.`
        : `O agendamento "${updated?.titulo || evento.titulo}" foi inativado.`,
      detalhes: {
        ativo,
      },
    },
    notify: {
      type: ativo ? "event_reactivated" : "event_cancelled",
      event: updated,
    },
  };
}

module.exports = {
  changeAgendaEventStatus,
};
