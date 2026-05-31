const { notify, resolveAdminRecipients } = require("../../shared/notificationService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { PRESENCA_LABELS } = require("./agendaMappingService");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

async function resolveAssistidoContactRecipients(evento) {
  const assistidos = Array.isArray(evento?.assistidoIds) && evento.assistidoIds.length
    ? evento.assistidoIds
    : evento?.assistidoId
      ? [evento.assistidoId]
      : [];

  const recipients = [];
  const seen = new Set();

  assistidos.forEach((assistido) => {
    const responsavel = assistido?.responsavel || null;
    const email = normalizeEmail(responsavel?.email);
    const telefone = normalizePhone(responsavel?.telefone);
    if (!email && !telefone) return;

    const key = `${email}|${telefone}`;
    if (seen.has(key)) return;
    seen.add(key);

    recipients.push({
      nome: responsavel?.nome || assistido?.nome || "Assistido",
      email: responsavel?.email || "",
      telefone: responsavel?.telefone || "",
      channels: ["email", "whatsapp"],
    });
  });

  return recipients;
}

async function resolveOperationalRecipients(
  evento,
  channels = ["sistema", "email", "whatsapp"]
) {
  const recipients = [];

  if (evento?.responsavelId?._id) {
    recipients.push({
      usuarioId: evento.responsavelId._id,
      nome: evento.responsavelId.nome,
      email: evento.responsavelId.email,
      telefone: evento.responsavelId.telefone,
      channels,
    });
  }

  const admins = await resolveAdminRecipients();
  admins.forEach((admin) => {
    recipients.push({
      ...admin,
      channels,
    });
  });

  return recipients;
}

function buildNotificationMeta(evento, extra = {}) {
  return {
    tituloEvento: evento?.titulo || "Agendamento",
    inicioLabel: toDateTimeLabel(evento?.inicio),
    responsavelNome: evento?.responsavelId?.nome || "",
    dependenteNome: evento?.assistidoId?.nome || "",
    statusAgendamento: evento?.statusAgendamento || "agendado",
    statusPresenca: PRESENCA_LABELS[evento?.statusPresenca || "pendente"] || "Atualizado",
    justificativa: evento?.presencaJustificativaLabel || "",
    ...extra,
  };
}

function buildAgendaNotificationDescriptor(type, evento, options = {}) {
  const meta = buildNotificationMeta(evento, {
    kind: type,
    previousStartLabel: options?.previousStart ? toDateTimeLabel(options.previousStart) : "",
  });

  if (type === "event_created") {
    return {
      eventKey: "agenda.evento_criado",
      title: "Nova consulta agendada",
      message: `Uma nova consulta foi agendada para ${meta.inicioLabel}.`,
      meta,
    };
  }

  if (type === "event_updated") {
    return {
      eventKey: "agenda.evento_atualizado",
      title: "Consulta atualizada",
      message: `Os dados da consulta "${meta.tituloEvento}" foram atualizados.`,
      meta,
    };
  }

  if (type === "event_moved") {
    return {
      eventKey: "agenda.evento_movido",
      title: "Consulta remarcada",
      message: meta.previousStartLabel
        ? `A consulta foi remarcada de ${meta.previousStartLabel} para ${meta.inicioLabel}.`
        : `A consulta foi remarcada para ${meta.inicioLabel}.`,
      meta,
    };
  }

  if (type === "event_cancelled") {
    return {
      eventKey: "agenda.evento_cancelado",
      title: "Consulta cancelada",
      message: `A consulta "${meta.tituloEvento}" foi cancelada.`,
      meta,
    };
  }

  if (type === "event_reactivated") {
    return {
      eventKey: "agenda.evento_reativado",
      title: "Consulta reativada",
      message: `A consulta "${meta.tituloEvento}" voltou a ficar ativa.`,
      meta,
    };
  }

  if (type === "attendance_absence_threshold_reached") {
    const absenceCount = Math.max(0, Number(options?.absenceCount || 0));
    const threshold = Math.max(0, Number(options?.threshold || 0));
    const dependenteNome = String(meta.dependenteNome || "assistido").trim();

    return {
      eventKey: "agenda.alerta_duas_faltas",
      title: "Alerta de faltas do assistido",
      message: `O assistido "${dependenteNome}" atingiu ${absenceCount || threshold || 0} faltas registradas na agenda.`,
      meta: {
        ...meta,
        absenceCount,
        threshold,
      },
    };
  }

  return {
    eventKey: "agenda.presenca_registrada",
    title: "Atualizacao de presenca do agendamento",
    message: `O agendamento "${meta.tituloEvento}" foi atualizado para ${meta.statusPresenca.toLowerCase()}.`,
    meta,
  };
}

async function dispatchAgendaNotifications(notification = {}) {
  const evento = notification?.event || null;
  if (!evento) return [];

  const descriptor = buildAgendaNotificationDescriptor(
    notification?.type || "attendance_registered",
    evento,
    notification
  );
  const contactRecipients = await resolveAssistidoContactRecipients(evento);
  let recipients = contactRecipients;

  if (notification?.type === "attendance_registered") {
    recipients = [...(await resolveOperationalRecipients(evento)), ...contactRecipients];
  } else if (notification?.type === "attendance_absence_threshold_reached") {
    recipients = await resolveOperationalRecipients(evento, ["sistema"]);
  }

  return notify({
    categoria: "agenda",
    evento: descriptor.eventKey,
    titulo: descriptor.title,
    mensagem: descriptor.message,
    recipients,
    referenciaTipo: "agenda_evento",
    referenciaId: evento?._id,
    payload: {
      meta: descriptor.meta,
    },
  });
}

module.exports = {
  dispatchAgendaNotifications,
  dispatchPresenceNotifications: (evento) =>
    dispatchAgendaNotifications({ type: "attendance_registered", event: evento }),
};
