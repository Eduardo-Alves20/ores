const {
  AgendaEvento,
  AGENDA_PRESENCA_STATUS_LIST,
} = require("../../../schemas/social/AgendaEvento");
const { asObjectId } = require("../../agendaAvailabilityService");
const { resolvePresenceReasonByKey } = require("../../systemConfigService");
const { canRegisterAttendance } = require("./agendaPermissionService");
const { createAgendaError, ensureAgendaObjectId } = require("./agendaErrorService");
const { mapEvento, getStatusAgendamentoForPresence, PRESENCA_LABELS } = require("./agendaMappingService");
const { carregarEventoDetalhado } = require("./agendaRelationService");
const {
  PERMISSIONS,
  ensureAgendaPermission,
} = require("./agendaEventMutationSupportService");

async function registerAgendaAttendance(user, eventId, body = {}) {
  ensureAgendaPermission(user, PERMISSIONS.AGENDA_ATTENDANCE, "Acesso negado para registrar presenca.");

  const normalizedEventId = ensureAgendaObjectId(eventId, "Identificador de agendamento invalido.");
  const evento = await AgendaEvento.findById(normalizedEventId);
  if (!evento) {
    throw createAgendaError(404, "Evento de agenda nao encontrado.");
  }

  if (!evento.ativo) {
    throw createAgendaError(400, "Nao e possivel registrar presenca em um agendamento inativo.");
  }

  if (!canRegisterAttendance(user, evento)) {
    throw createAgendaError(403, "Sem permissao para registrar presenca neste agendamento.");
  }

  const statusPresenca = String(body?.statusPresenca || "").trim();
  if (!AGENDA_PRESENCA_STATUS_LIST.includes(statusPresenca)) {
    throw createAgendaError(400, "Status de presenca invalido.");
  }

  const actorId = asObjectId(user.id);
  const presencaObservacao = String(body?.observacao || "").trim().slice(0, 1000);
  const justificativaKey = String(body?.justificativaKey || "").trim();
  const statusAgendamento = getStatusAgendamentoForPresence(evento.statusAgendamento, statusPresenca);
  const canUseJustificativa = ["falta", "falta_justificada", "cancelado_antecipadamente"].includes(statusPresenca);
  const justificativa =
    justificativaKey && canUseJustificativa
      ? await resolvePresenceReasonByKey(justificativaKey, statusPresenca)
      : null;

  if (canUseJustificativa && justificativaKey && !justificativa) {
    throw createAgendaError(400, "Justificativa de presenca invalida.");
  }

  await AgendaEvento.findByIdAndUpdate(
    evento._id,
    {
      statusPresenca,
      statusAgendamento,
      presencaObservacao,
      presencaJustificativaKey: canUseJustificativa && justificativa ? justificativaKey : "",
      presencaJustificativaLabel: justificativa?.nome || "",
      presencaRegistradaEm: new Date(),
      presencaRegistradaPor: actorId,
      atualizadoPor: actorId,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  const detalhe = await carregarEventoDetalhado(evento._id);

  return {
    mensagem: "Presenca atualizada com sucesso.",
    evento: mapEvento(detalhe.evento),
    historico: detalhe.historico,
    notify: {
      type: "attendance_registered",
      event: detalhe.evento,
    },
    audit: {
      acao: "AGENDA_PRESENCA_REGISTRADA",
      entidade: "agenda_evento",
      entidadeId: evento._id,
      detalhes: {
        statusPresenca,
        statusAgendamento,
      },
    },
    history: {
      eventoId: evento._id,
      tipo: "presenca_registrada",
      visibilidade: detalhe?.evento?.familiaId ? "todos" : "interna",
      titulo: "Presenca atualizada",
      descricao: `O agendamento "${detalhe?.evento?.titulo || evento.titulo}" foi marcado como ${
        PRESENCA_LABELS[statusPresenca] || "Atualizado"
      }.`,
      detalhes: {
        statusPresenca,
        statusAgendamento,
        justificativa: justificativa?.nome || "",
        observacao: presencaObservacao || "",
      },
    },
  };
}

module.exports = {
  registerAgendaAttendance,
};
