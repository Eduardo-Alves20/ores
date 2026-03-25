const { AgendaEvento, TIPOS_AGENDA } = require("../../../schemas/social/AgendaEvento");
const { asObjectId, buildAgendaInterval } = require("../../agendaAvailabilityService");
const { canAssignOthers, canMutateEvent } = require("./agendaPermissionService");
const { createAgendaError, ensureAgendaObjectId } = require("./agendaErrorService");
const {
  isProvided,
  parseDateInput,
  sanitizeTitle,
} = require("./agendaDateValueService");
const { mapEvento } = require("./agendaMappingService");
const { loadEventoById, resolveRelations, resolveSalaSelection } = require("./agendaRelationService");
const {
  PERMISSIONS,
  buildAgendaUpdatePayload,
  ensureActiveResponsible,
  ensureAgendaPermission,
} = require("./agendaEventMutationSupportService");

async function updateAgendaEvent(user, eventId, body = {}) {
  ensureAgendaPermission(user, PERMISSIONS.AGENDA_UPDATE, "Acesso negado para agenda.");

  const normalizedEventId = ensureAgendaObjectId(eventId, "Identificador de agendamento invalido.");
  const evento = await AgendaEvento.findById(normalizedEventId);
  if (!evento) {
    throw createAgendaError(404, "Evento de agenda nao encontrado.");
  }

  if (!canMutateEvent(user, evento)) {
    throw createAgendaError(403, "Sem permissao para alterar este evento.");
  }

  const actorId = asObjectId(user.id);
  const patch = { atualizadoPor: actorId };
  const flags = buildAgendaUpdatePayload(evento, body);

  if (flags.hasTitulo) {
    const titulo = sanitizeTitle(body?.titulo);
    if (!titulo) throw createAgendaError(400, "Campo titulo nao pode ser vazio.");
    patch.titulo = titulo;
  }

  if (flags.hasTipoAtendimento) {
    const tipoAtendimento = String(body?.tipoAtendimento || "").trim();
    if (!TIPOS_AGENDA.includes(tipoAtendimento)) {
      throw createAgendaError(400, "Tipo de atendimento invalido.");
    }
    patch.tipoAtendimento = tipoAtendimento;
  }

  if (flags.hasInicio) {
    const inicio = parseDateInput(body?.inicio);
    if (!inicio) throw createAgendaError(400, "Data de inicio invalida.");
    patch.inicio = inicio;
  }

  if (flags.hasFim) {
    if (!body?.fim) {
      patch.fim = null;
    } else {
      const fim = parseDateInput(body?.fim);
      if (!fim) throw createAgendaError(400, "Data de fim invalida.");
      patch.fim = fim;
    }
  }

  const nextInicio = patch.inicio || evento.inicio;
  const rawNextFim = Object.prototype.hasOwnProperty.call(patch, "fim") ? patch.fim : evento.fim;
  const intervalo = buildAgendaInterval({ inicio: nextInicio, fim: rawNextFim });
  if (!intervalo.inicio || !intervalo.fim || intervalo.fim <= intervalo.inicio) {
    throw createAgendaError(400, "Data de fim deve ser maior que a data de inicio.");
  }

  patch.fim = intervalo.fim;

  if (Object.prototype.hasOwnProperty.call(body, "local")) {
    patch.local = String(body?.local || "").trim().slice(0, 240);
  }

  if (Object.prototype.hasOwnProperty.call(body, "observacoes")) {
    patch.observacoes = String(body?.observacoes || "").trim().slice(0, 3000);
  }

  if (flags.hasFamilia || flags.hasPaciente) {
    if (flags.hasFamilia && isProvided(body?.familiaId) && !asObjectId(body?.familiaId)) {
      throw createAgendaError(400, "familiaId invalido.");
    }
    if (flags.hasPaciente && isProvided(body?.pacienteId) && !asObjectId(body?.pacienteId)) {
      throw createAgendaError(400, "pacienteId invalido.");
    }

    const familiaIdInput = flags.hasFamilia ? body?.familiaId || null : flags.currentFamiliaId || null;
    const pacienteIdInput = flags.hasPaciente ? body?.pacienteId || null : flags.currentPacienteId || null;

    const relation = await resolveRelations({ familiaIdInput, pacienteIdInput });
    if (relation.error) {
      throw createAgendaError(relation.status || 400, relation.error);
    }

    patch.familiaId = relation.familiaId || null;
    patch.pacienteId = relation.pacienteId || null;
  }

  if (flags.hasResponsavel) {
    if (!canAssignOthers(user)) {
      throw createAgendaError(403, "Sem permissao para mudar responsavel.");
    }

    const responsavelId = asObjectId(body?.responsavelId);
    if (isProvided(body?.responsavelId) && !responsavelId) {
      throw createAgendaError(400, "Responsavel invalido.");
    }
    if (!responsavelId) {
      throw createAgendaError(400, "Responsavel invalido.");
    }

    await ensureActiveResponsible(responsavelId);
    patch.responsavelId = responsavelId;
  }

  const nextTipoAtendimento = patch.tipoAtendimento || flags.currentTipoAtendimento;
  const nextSalaInput = flags.hasSala ? body?.salaId || null : flags.currentSalaId || null;
  const allowEmptyRoom =
    !flags.hasSala &&
    !flags.hasTipoAtendimento &&
    !asObjectId(flags.currentSalaId);

  const salaSelection = await resolveSalaSelection({
    salaIdInput: nextSalaInput,
    tipoAtendimento: nextTipoAtendimento,
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    ignoreEventId: evento._id,
    allowEmptyRoom,
  });

  if (salaSelection.error) {
    throw createAgendaError(salaSelection.status || 400, salaSelection.error);
  }

  patch.salaId = salaSelection.salaId || null;

  await AgendaEvento.findByIdAndUpdate(evento._id, patch, {
    new: true,
    runValidators: true,
  });

  const updated = await loadEventoById(evento._id);

  return {
    mensagem: "Agendamento atualizado com sucesso.",
    evento: mapEvento(updated),
    audit: {
      acao: "AGENDA_EVENTO_ATUALIZADO",
      entidade: "agenda_evento",
      entidadeId: evento._id,
    },
    history: {
      eventoId: evento._id,
      tipo: "agendamento_atualizado",
      visibilidade: updated?.familiaId ? "todos" : "interna",
      titulo: "Agendamento atualizado",
      descricao: `O agendamento "${updated?.titulo || evento.titulo}" foi atualizado.`,
      detalhes: {
        tipoAtendimento: updated?.tipoAtendimento || evento.tipoAtendimento,
      },
    },
    notify: {
      type: "event_updated",
      event: updated,
    },
  };
}

module.exports = {
  updateAgendaEvent,
};
