const { getEffectiveEnd } = require("../../shared/agendaAvailabilityService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const {
  sanitizeExternalText,
} = require("./portalFamilyPolicyService");

function toIsoStringOrEmpty(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function formatDateOnly(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
}

function formatBirthDate(dateLike) {
  return formatDateOnly(dateLike);
}

function formatAddress(endereco = {}) {
  const parts = [
    endereco?.rua,
    endereco?.numero,
    endereco?.bairro,
    endereco?.cidade,
    endereco?.estado,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : "-";
}

function mapTipoAgendaLabel(tipo) {
  const labels = {
    visita_domiciliar: "Visita domiciliar",
    atendimento_sede: "Atendimento na sede",
    entrega_beneficio: "Entrega de beneficio",
    reuniao_equipe: "Reuniao de equipe",
    outro: "Consulta",
  };

  return labels[String(tipo || "").trim()] || "Consulta";
}

function mapAgendaStatusLabel(status) {
  const labels = {
    agendado: "Agendada",
    encerrado: "Encerrada",
    cancelado: "Cancelada",
    em_analise_cancelamento: "Em analise",
    em_negociacao_remarcacao: "Remarcacao em analise",
    remarcado: "Remarcada",
  };

  return labels[String(status || "").trim()] || "Agendada";
}

function mapPresenceStatusLabel(status) {
  const labels = {
    pendente: "Pendente",
    presente: "Compareceu",
    falta: "Faltou",
    falta_justificada: "Falta justificada",
    cancelado_antecipadamente: "Cancelada antecipadamente",
  };

  return labels[String(status || "").trim()] || "Pendente";
}

function mapAppointmentTone(item = {}) {
  const statusPresenca = String(item?.statusPresenca || "").trim();
  const statusAgendamento = String(item?.statusAgendamento || "").trim();

  if (statusPresenca === "presente") return "success";
  if (["falta", "falta_justificada"].includes(statusPresenca)) return "danger";
  if (statusAgendamento === "cancelado") return "danger";
  if (statusAgendamento === "remarcado") return "warning";
  if (statusPresenca === "cancelado_antecipadamente") return "warning";
  return "neutral";
}

function mapTipoDeficienciaLabel(value) {
  const labels = {
    fisica: "Fisica",
    intelectual: "Intelectual",
    auditiva: "Auditiva",
    visual: "Visual",
    multipla: "Multipla",
    transtorno_espectro_autista: "TEA",
    outra: "Outra",
  };

  return labels[String(value || "").trim()] || "Nao informado";
}

function mapDependenteCard(item = {}) {
  return {
    id: String(item?._id || ""),
    nome: sanitizeExternalText(item?.nome, "Dependente"),
    dataNascimentoLabel: formatBirthDate(item?.dataNascimento),
    tipoDeficienciaLabel: mapTipoDeficienciaLabel(item?.tipoDeficiencia),
    ativo: item?.ativo !== false,
  };
}

function mapAppointmentCard(item = {}) {
  return {
    id: String(item?._id || ""),
    titulo: sanitizeExternalText(item?.titulo, "Consulta"),
    tipoAtendimentoLabel: mapTipoAgendaLabel(item?.tipoAtendimento),
    dataHoraIso: toIsoStringOrEmpty(item?.inicio),
    dataHoraLabel: toDateTimeLabel(item?.inicio),
    dataLabel: formatDateOnly(item?.inicio),
    dependenteNome: sanitizeExternalText(item?.pacienteId?.nome, "Familia"),
    profissionalNome: sanitizeExternalText(item?.responsavelId?.nome, "Equipe Alento"),
    salaNome: sanitizeExternalText(item?.salaId?.nome, "-"),
    local: sanitizeExternalText(item?.local, "-"),
    statusAgendamento: String(item?.statusAgendamento || "agendado"),
    statusAgendamentoLabel: mapAgendaStatusLabel(item?.statusAgendamento),
    statusPresenca: String(item?.statusPresenca || "pendente"),
    statusPresencaLabel: mapPresenceStatusLabel(item?.statusPresenca),
    tone: mapAppointmentTone(item),
  };
}

function mapPortalFamilyAgendaEvent(item = {}) {
  const effectiveEnd = getEffectiveEnd(item?.inicio, item?.fim);

  return {
    id: String(item?._id || ""),
    titulo: sanitizeExternalText(item?.titulo, "Consulta"),
    tipoAtendimento: String(item?.tipoAtendimento || "outro"),
    tipoAtendimentoLabel: mapTipoAgendaLabel(item?.tipoAtendimento),
    inicio: item?.inicio ? new Date(item.inicio).toISOString() : "",
    fim: effectiveEnd ? new Date(effectiveEnd).toISOString() : "",
    dataHoraLabel: toDateTimeLabel(item?.inicio),
    dependenteNome: sanitizeExternalText(item?.pacienteId?.nome, "Familia"),
    profissionalNome: sanitizeExternalText(
      item?.responsavelId?.nome,
      "Equipe Alento"
    ),
    salaNome: sanitizeExternalText(item?.salaId?.nome, "-"),
    local: sanitizeExternalText(item?.local, "-"),
    statusAgendamento: String(item?.statusAgendamento || "agendado"),
    statusAgendamentoLabel: mapAgendaStatusLabel(item?.statusAgendamento),
    statusPresenca: String(item?.statusPresenca || "pendente"),
    statusPresencaLabel: mapPresenceStatusLabel(item?.statusPresenca),
    ativo: item?.ativo !== false,
    tone: mapAppointmentTone(item),
  };
}

function mapNotificationType(item = {}) {
  const kind = String(item?.payload?.meta?.kind || item?.evento || "").toLowerCase();

  if (
    kind.includes("cancel") ||
    kind.includes("falta") ||
    kind.includes("ausencia")
  ) {
    return "alert";
  }

  return "info";
}

function mapNotificationEventLabel(evento) {
  const labels = {
    "agenda.evento_criado": "Consulta criada",
    "agenda.evento_atualizado": "Consulta atualizada",
    "agenda.evento_movido": "Consulta remarcada",
    "agenda.evento_cancelado": "Consulta cancelada",
    "agenda.evento_reativado": "Consulta reativada",
    "agenda.presenca_registrada": "Status da consulta",
  };

  return labels[String(evento || "").trim()] || "Atualizacao da consulta";
}

function buildNotificationLink(item = {}) {
  const referenciaId = String(item?.referenciaId || "").trim();
  if (!referenciaId) return "/minha-familia/consultas";
  return `/minha-familia/consultas?evento=${encodeURIComponent(referenciaId)}`;
}

function mapNotificationCard(item = {}) {
  const type = mapNotificationType(item);

  return {
    id: String(item?._id || ""),
    titulo: sanitizeExternalText(item?.titulo, "Atualizacao da consulta"),
    mensagem: sanitizeExternalText(item?.mensagem, "Uma atualizacao foi registrada."),
    eventoLabel: mapNotificationEventLabel(item?.evento),
    tipo: type,
    tipoLabel: type === "alert" ? "Alerta" : "Informativa",
    lida: !!item?.lidoEm,
    criadoEm: item?.createdAt || null,
    criadoEmIso: item?.createdAt ? new Date(item.createdAt).toISOString() : "",
    criadoEmLabel: item?.createdAt ? toDateTimeLabel(item.createdAt) : "-",
    href: buildNotificationLink(item),
  };
}

module.exports = {
  buildNotificationLink,
  formatAddress,
  formatBirthDate,
  formatDateOnly,
  mapAgendaStatusLabel,
  mapAppointmentCard,
  mapDependenteCard,
  mapNotificationCard,
  mapNotificationType,
  mapPortalFamilyAgendaEvent,
  mapPresenceStatusLabel,
  mapTipoAgendaLabel,
  toIsoStringOrEmpty,
};
