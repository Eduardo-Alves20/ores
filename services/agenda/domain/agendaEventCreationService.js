const {
  AgendaEvento,
  TIPOS_AGENDA,
} = require("../../../schemas/social/AgendaEvento");
const {
  AGENDA_DEFAULT_DURATION_MINUTES,
  asObjectId,
  buildAgendaInterval,
} = require("../../agendaAvailabilityService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { canAssignOthers } = require("./agendaPermissionService");
const { createAgendaError } = require("./agendaErrorService");
const {
  isProvided,
  parseDateInput,
  sanitizeTitle,
} = require("./agendaDateValueService");
const { mapEvento } = require("./agendaMappingService");
const { loadEventoById, resolveRelations, resolveSalaSelection } = require("./agendaRelationService");
const {
  PERMISSIONS,
  ensureActiveResponsible,
  ensureAgendaPermission,
} = require("./agendaEventMutationSupportService");

async function createAgendaEvent(user, body = {}) {
  ensureAgendaPermission(user, PERMISSIONS.AGENDA_CREATE, "Acesso negado para agenda.");

  const actorId = asObjectId(user.id);
  if (!actorId) {
    throw createAgendaError(401, "Sessao invalida.");
  }

  const titulo = sanitizeTitle(body?.titulo);
  const tipoAtendimento = String(body?.tipoAtendimento || "outro");
  const local = String(body?.local || "").trim().slice(0, 240);
  const observacoes = String(body?.observacoes || "").trim().slice(0, 3000);
  const inicio = parseDateInput(body?.inicio);
  const fim = parseDateInput(body?.fim);

  if (!titulo) {
    throw createAgendaError(400, "Campo titulo e obrigatorio.");
  }

  if (!inicio) {
    throw createAgendaError(400, "Campo inicio e obrigatorio.");
  }

  if (!TIPOS_AGENDA.includes(tipoAtendimento)) {
    throw createAgendaError(400, "Tipo de atendimento invalido.");
  }

  const intervalo = buildAgendaInterval({ inicio, fim });
  if (!intervalo.inicio || !intervalo.fim || intervalo.fim <= intervalo.inicio) {
    throw createAgendaError(400, "Data de fim deve ser maior que a data de inicio.");
  }

  if (isProvided(body?.familiaId) && !asObjectId(body?.familiaId)) {
    throw createAgendaError(400, "familiaId invalido.");
  }

  if (isProvided(body?.pacienteId) && !asObjectId(body?.pacienteId)) {
    throw createAgendaError(400, "pacienteId invalido.");
  }

  const relation = await resolveRelations({
    familiaIdInput: body?.familiaId || null,
    pacienteIdInput: body?.pacienteId || null,
  });

  if (relation.error) {
    throw createAgendaError(relation.status || 400, relation.error);
  }

  let responsavelId = actorId;
  if (canAssignOthers(user)) {
    const candidate = asObjectId(body?.responsavelId);
    if (isProvided(body?.responsavelId) && !candidate) {
      throw createAgendaError(400, "responsavelId invalido.");
    }
    if (candidate) responsavelId = candidate;
  }

  await ensureActiveResponsible(responsavelId);

  const salaSelection = await resolveSalaSelection({
    salaIdInput: body?.salaId || null,
    tipoAtendimento,
    inicio: intervalo.inicio,
    fim: intervalo.fim,
  });

  if (salaSelection.error) {
    throw createAgendaError(salaSelection.status || 400, salaSelection.error);
  }

  const evento = await AgendaEvento.create({
    titulo,
    tipoAtendimento,
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    local,
    observacoes,
    salaId: salaSelection.salaId || null,
    familiaId: relation.familiaId || null,
    pacienteId: relation.pacienteId || null,
    responsavelId,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  const loaded = await loadEventoById(evento._id);

  return {
    mensagem: "Agendamento criado com sucesso.",
    evento: mapEvento(loaded),
    audit: {
      acao: "AGENDA_EVENTO_CRIADO",
      entidade: "agenda_evento",
      entidadeId: evento._id,
      detalhes: {
        responsavelId,
        familiaId: relation.familiaId || null,
        pacienteId: relation.pacienteId || null,
        salaId: salaSelection.salaId || null,
        duracaoMinutos: AGENDA_DEFAULT_DURATION_MINUTES,
      },
    },
    history: {
      eventoId: evento._id,
      tipo: "agendamento_criado",
      visibilidade: relation.familiaId ? "todos" : "interna",
      titulo: "Agendamento criado",
      descricao: `O agendamento "${titulo}" foi criado para ${toDateTimeLabel(intervalo.inicio)}.`,
      detalhes: {
        tipoAtendimento,
        responsavelId,
        familiaId: relation.familiaId || null,
        pacienteId: relation.pacienteId || null,
        salaId: salaSelection.salaId || null,
      },
    },
    notify: {
      type: "event_created",
      event: loaded,
    },
  };
}

module.exports = {
  createAgendaEvent,
};
