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

const ABSENCE_ALERT_THRESHOLD = 2;
const ABSENCE_ALERT_STATUSES = Object.freeze(["falta", "falta_justificada"]);

function hasAbsenceStatus(statusPresenca = "") {
  return ABSENCE_ALERT_STATUSES.includes(String(statusPresenca || "").trim());
}

function shouldTriggerAbsenceAlert({
  previousStatusPresenca,
  nextStatusPresenca,
  totalAbsences,
} = {}) {
  return (
    hasAbsenceStatus(nextStatusPresenca) &&
    !hasAbsenceStatus(previousStatusPresenca) &&
    Number(totalAbsences || 0) === ABSENCE_ALERT_THRESHOLD
  );
}

function extractPatientId(evento = {}) {
  return evento?.pacienteId?._id || evento?.pacienteId || null;
}

async function countPatientAbsences(patientId) {
  const normalizedPatientId = asObjectId(patientId);
  if (!normalizedPatientId) return 0;

  return AgendaEvento.countDocuments({
    ativo: true,
    pacienteId: normalizedPatientId,
    statusPresenca: {
      $in: ABSENCE_ALERT_STATUSES,
    },
  });
}

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
  const previousStatusPresenca = String(evento.statusPresenca || "").trim();
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
  const notifications = [
    {
      type: "attendance_registered",
      event: detalhe.evento,
    },
  ];

  const patientId = extractPatientId(detalhe?.evento);
  if (hasAbsenceStatus(statusPresenca) && patientId) {
    const totalAbsences = await countPatientAbsences(patientId);
    if (
      shouldTriggerAbsenceAlert({
        previousStatusPresenca,
        nextStatusPresenca: statusPresenca,
        totalAbsences,
      })
    ) {
      notifications.push({
        type: "attendance_absence_threshold_reached",
        event: detalhe.evento,
        absenceCount: totalAbsences,
        threshold: ABSENCE_ALERT_THRESHOLD,
      });
    }
  }

  return {
    mensagem: "Presenca atualizada com sucesso.",
    evento: mapEvento(detalhe.evento),
    historico: detalhe.historico,
    notify: notifications,
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
  ABSENCE_ALERT_STATUSES,
  ABSENCE_ALERT_THRESHOLD,
  countPatientAbsences,
  registerAgendaAttendance,
  shouldTriggerAbsenceAlert,
};
