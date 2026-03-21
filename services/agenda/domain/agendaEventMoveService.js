const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { asObjectId, getEffectiveEnd } = require("../../agendaAvailabilityService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { canMutateEvent } = require("./agendaPermissionService");
const { createAgendaError } = require("./agendaErrorService");
const { parseDateInput } = require("./agendaDateValueService");
const { mapEvento } = require("./agendaMappingService");
const { loadEventoById, resolveSalaSelection } = require("./agendaRelationService");
const {
  PERMISSIONS,
  ensureAgendaPermission,
} = require("./agendaEventMutationSupportService");

async function moveAgendaEvent(user, eventId, body = {}) {
  ensureAgendaPermission(user, PERMISSIONS.AGENDA_MOVE, "Acesso negado para agenda.");

  const evento = await AgendaEvento.findById(eventId);
  if (!evento) {
    throw createAgendaError(404, "Evento de agenda nao encontrado.");
  }

  if (!canMutateEvent(user, evento)) {
    throw createAgendaError(403, "Sem permissao para mover este evento.");
  }

  const novoInicioCompleto = parseDateInput(body?.novoInicio);
  let novoInicio = novoInicioCompleto;

  if (!novoInicio) {
    const novaData = String(body?.novaData || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
      throw createAgendaError(400, "Informe novaData no formato YYYY-MM-DD.");
    }

    const [ano, mes, dia] = novaData.split("-").map(Number);
    const original = new Date(evento.inicio);
    novoInicio = new Date(
      ano,
      mes - 1,
      dia,
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
      original.getMilliseconds()
    );
  }

  if (Number.isNaN(novoInicio.getTime())) {
    throw createAgendaError(400, "Data de destino invalida.");
  }

  let novoFim = null;
  if (evento.fim) {
    const duracaoMs = new Date(evento.fim).getTime() - new Date(evento.inicio).getTime();
    if (duracaoMs > 0) {
      novoFim = new Date(novoInicio.getTime() + duracaoMs);
    }
  }

  if (!novoFim) {
    novoFim = getEffectiveEnd(novoInicio, null);
  }

  const salaSelection = await resolveSalaSelection({
    salaIdInput: evento.salaId || null,
    tipoAtendimento: evento.tipoAtendimento,
    inicio: novoInicio,
    fim: novoFim,
    ignoreEventId: evento._id,
    allowEmptyRoom: !asObjectId(evento.salaId),
  });

  if (salaSelection.error) {
    throw createAgendaError(salaSelection.status || 400, salaSelection.error);
  }

  const actorId = asObjectId(user.id);

  await AgendaEvento.findByIdAndUpdate(
    evento._id,
    {
      inicio: novoInicio,
      fim: novoFim,
      atualizadoPor: actorId,
      salaId: salaSelection.salaId || null,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  const updated = await loadEventoById(evento._id);

  return {
    mensagem: "Agendamento movido com sucesso.",
    evento: mapEvento(updated),
    audit: {
      acao: "AGENDA_EVENTO_MOVIDO",
      entidade: "agenda_evento",
      entidadeId: evento._id,
      detalhes: {
        de: evento.inicio,
        para: novoInicio,
      },
    },
    history: {
      eventoId: evento._id,
      tipo: "agendamento_movido",
      visibilidade: updated?.familiaId ? "todos" : "interna",
      titulo: "Agendamento movido",
      descricao: `O agendamento "${updated?.titulo || evento.titulo}" foi remanejado para ${toDateTimeLabel(
        updated?.inicio || novoInicio
      )}.`,
      detalhes: {
        de: evento.inicio,
        para: updated?.inicio || novoInicio,
      },
    },
    notify: {
      type: "event_moved",
      event: updated,
      previousStart: evento.inicio,
    },
  };
}

module.exports = {
  moveAgendaEvent,
};
