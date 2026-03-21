const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const {
  AGENDAMENTO_LABELS,
  PRESENCA_LABELS,
} = require("../../agenda/domain/agendaMappingService");

function mapAgendaPresenca(doc) {
  return {
    _id: doc?._id,
    titulo: doc?.titulo || "Consulta",
    inicio: doc?.inicio || null,
    inicioLabel: doc?.inicio ? toDateTimeLabel(doc.inicio) : "-",
    tipoAtendimento: doc?.tipoAtendimento || "outro",
    statusAgendamento: doc?.statusAgendamento || "agendado",
    statusAgendamentoLabel:
      AGENDAMENTO_LABELS[doc?.statusAgendamento || "agendado"] || "Agendado",
    statusPresenca: doc?.statusPresenca || "pendente",
    statusPresencaLabel:
      PRESENCA_LABELS[doc?.statusPresenca || "pendente"] || "Pendente",
    presencaObservacao: doc?.presencaObservacao || "",
    presencaJustificativaLabel: doc?.presencaJustificativaLabel || "",
    local: doc?.local || "",
    salaNome: doc?.salaId?.nome || "",
    pacienteNome: doc?.pacienteId?.nome || "",
    responsavelNome: doc?.responsavelId?.nome || "",
    presencaRegistradaEm: doc?.presencaRegistradaEm || null,
    presencaRegistradaEmLabel: doc?.presencaRegistradaEm
      ? toDateTimeLabel(doc.presencaRegistradaEm)
      : "-",
    presencaRegistradaPorNome: doc?.presencaRegistradaPor?.nome || "",
    ativo: !!doc?.ativo,
  };
}

module.exports = {
  mapAgendaPresenca,
};
