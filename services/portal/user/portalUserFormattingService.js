const { TIPOS_ATENDIMENTO } = require("../../../schemas/social/Atendimento");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");

const USER_FAMILIA_LIMIT_OPTIONS = Object.freeze([9, 12, 18, 30, 60]);
const USER_AGENDA_LIMIT = 12;

function toIsoStringOrEmpty(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function mapTipoCadastroLabel(tipoCadastro) {
  if (tipoCadastro === "familia") return "Família";
  if (tipoCadastro === "orgao_publico") return "Órgão Público";
  return "Voluntário";
}

function mapTipoAtendimentoLabel(tipo) {
  const labels = {
    ligacao: "Ligacao",
    presencial: "Presencial",
    mensagem: "Mensagem",
    whatsapp: "Whatsapp",
    videochamada: "Videochamada",
    outro: "Outro",
  };
  const value = String(tipo || "").toLowerCase().trim();
  return labels[value] || "Outro";
}

function buildTipoAtendimentoOptions() {
  return TIPOS_ATENDIMENTO.map((tipo) => ({
    value: tipo,
    label: mapTipoAtendimentoLabel(tipo),
  }));
}

function mapDayLabel(dateLike) {
  if (!dateLike) return "-";
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
}

function mapMonthLabel(dateLike) {
  if (!dateLike) return "Mes indefinido";
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "Mes indefinido";
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(dt);
  return label.replace(/^\w/, (char) => char.toUpperCase());
}

function mapAgendaStatusLabel(status) {
  const labels = {
    agendado: "Agendado",
    encerrado: "Encerrado",
    cancelado: "Cancelado",
    em_analise_cancelamento: "Em analise de cancelamento",
    em_negociacao_remarcacao: "Em negociacao de remarcacao",
    remarcado: "Remarcado",
  };
  return labels[String(status || "").trim()] || "Agendado";
}

function mapPresenceStatusLabel(status) {
  const labels = {
    pendente: "Pendente",
    presente: "Presente",
    falta: "Falta",
    falta_justificada: "Falta justificada",
    cancelado_antecipadamente: "Cancelado antecipadamente",
  };
  return labels[String(status || "").trim()] || "Pendente";
}

function mapAgendaCard(item) {
  return {
    id: String(item?._id || ""),
    titulo: item?.titulo || "Agendamento",
    dataHoraIso: toIsoStringOrEmpty(item?.inicio),
    dataHoraLabel: toDateTimeLabel(item?.inicio),
    diaLabel: mapDayLabel(item?.inicio),
    profissionalNome: item?.responsavelId?.nome || "Nao informado",
    salaNome: item?.salaId?.nome || "-",
    local: item?.local || "-",
    statusAgendamento: item?.statusAgendamento || "agendado",
    statusAgendamentoLabel: mapAgendaStatusLabel(item?.statusAgendamento),
    statusPresenca: item?.statusPresenca || "pendente",
    statusPresencaLabel: mapPresenceStatusLabel(item?.statusPresenca),
    observacoes: item?.observacoes || "-",
    presencaObservacao: item?.presencaObservacao || "",
  };
}

module.exports = {
  USER_AGENDA_LIMIT,
  USER_FAMILIA_LIMIT_OPTIONS,
  buildTipoAtendimentoOptions,
  mapAgendaCard,
  mapDayLabel,
  mapMonthLabel,
  mapTipoAtendimentoLabel,
  mapTipoCadastroLabel,
  toIsoStringOrEmpty,
};
