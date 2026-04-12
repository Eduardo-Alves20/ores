const { getEffectiveEnd } = require("../../shared/agendaAvailabilityService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { PRESENCA_LABELS } = require("../presence/presenceConstants");

const AGENDAMENTO_LABELS = Object.freeze({
  agendado: "Agendado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  em_analise_cancelamento: "Em analise de cancelamento",
  em_negociacao_remarcacao: "Em negociacao de remarcacao",
  remarcado: "Remarcado",
});

function toDayDateString(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeString(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  const hour = String(dt.getHours()).padStart(2, "0");
  const minute = String(dt.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function getStatusAgendamentoForPresence(currentStatusAgendamento, statusPresenca) {
  if (statusPresenca === "cancelado_antecipadamente") return "cancelado";
  if (statusPresenca === "presente" || statusPresenca === "falta" || statusPresenca === "falta_justificada") {
    return "encerrado";
  }
  if (currentStatusAgendamento === "remarcado") return "remarcado";
  return "agendado";
}

function mapHistorico(doc) {
  return {
    _id: doc?._id,
    tipo: doc?.tipo || "",
    titulo: doc?.titulo || "",
    descricao: doc?.descricao || "",
    visibilidade: doc?.visibilidade || "interna",
    atorNome: doc?.atorNome || "",
    atorPerfil: doc?.atorPerfil || "",
    createdAt: doc?.createdAt || null,
    createdAtLabel: doc?.createdAt ? toDateTimeLabel(doc.createdAt) : "-",
  };
}

function mapSala(doc) {
  const sala = doc?.toObject ? doc.toObject() : doc;
  if (!sala) return null;

  return {
    _id: sala._id,
    nome: sala.nome || "",
    descricao: sala.descricao || "",
    ativo: sala.ativo !== false,
  };
}

function mapEvento(doc) {
  const evento = doc?.toObject ? doc.toObject() : doc;
  const inicio = evento?.inicio ? new Date(evento.inicio) : null;
  const fim = getEffectiveEnd(evento?.inicio, evento?.fim);

  return {
    _id: evento?._id,
    titulo: evento?.titulo || "",
    tipoAtendimento: evento?.tipoAtendimento || "outro",
    inicio: evento?.inicio,
    fim: fim || null,
    local: evento?.local || "",
    observacoes: evento?.observacoes || "",
    statusAgendamento: evento?.statusAgendamento || "agendado",
    statusAgendamentoLabel:
      AGENDAMENTO_LABELS[evento?.statusAgendamento || "agendado"] || "Agendado",
    statusPresenca: evento?.statusPresenca || "pendente",
    statusPresencaLabel:
      PRESENCA_LABELS[evento?.statusPresenca || "pendente"] || "Pendente",
    presencaObservacao: evento?.presencaObservacao || "",
    presencaJustificativaKey: evento?.presencaJustificativaKey || "",
    presencaJustificativaLabel: evento?.presencaJustificativaLabel || "",
    ativo: !!evento?.ativo,
    dia: inicio ? toDayDateString(inicio) : "",
    hora: inicio ? toTimeString(inicio) : "",
    sala: mapSala(evento?.salaId),
    familia: evento?.familiaId
      ? {
          _id: evento.familiaId._id || evento.familiaId,
          responsavelNome: evento.familiaId?.responsavel?.nome || "",
          cidade: evento.familiaId?.endereco?.cidade || "",
        }
      : null,
    paciente: evento?.pacienteId
      ? {
          _id: evento.pacienteId._id || evento.pacienteId,
          nome: evento.pacienteId?.nome || "",
        }
      : null,
    presencaRegistradaPor: evento?.presencaRegistradaPor
      ? {
          _id: evento.presencaRegistradaPor._id || evento.presencaRegistradaPor,
          nome: evento.presencaRegistradaPor?.nome || "",
        }
      : null,
    presencaRegistradaEm: evento?.presencaRegistradaEm || null,
    presencaRegistradaEmLabel: evento?.presencaRegistradaEm
      ? toDateTimeLabel(evento.presencaRegistradaEm)
      : "-",
    responsavel: evento?.responsavelId
      ? {
          _id: evento.responsavelId._id || evento.responsavelId,
          nome: evento.responsavelId?.nome || "",
          perfil: evento.responsavelId?.perfil || "",
          email: evento.responsavelId?.email || "",
          telefone: evento.responsavelId?.telefone || "",
        }
      : null,
  };
}

module.exports = {
  AGENDAMENTO_LABELS,
  PRESENCA_LABELS,
  getStatusAgendamentoForPresence,
  mapHistorico,
  mapSala,
  mapEvento,
};
