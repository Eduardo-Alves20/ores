const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TIPOS_AGENDA = [
  "visita_domiciliar",
  "atendimento_sede",
  "entrega_beneficio",
  "reuniao_equipe",
  "outro",
];

const AGENDA_ROOM_REQUIRED_TYPES = ["atendimento_sede"];
const AGENDA_DEFAULT_DURATION_MINUTES = 30;
const AGENDA_STATUS_LIST = [
  "agendado",
  "encerrado",
  "cancelado",
  "em_analise_cancelamento",
  "em_negociacao_remarcacao",
  "remarcado",
];
const AGENDA_PRESENCA_STATUS_LIST = [
  "pendente",
  "presente",
  "falta",
  "falta_justificada",
  "cancelado_antecipadamente",
];

const AgendaEventoSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    tipoAtendimento: {
      type: String,
      enum: TIPOS_AGENDA,
      default: "outro",
      index: true,
    },
    inicio: {
      type: Date,
      required: true,
      index: true,
    },
    fim: {
      type: Date,
      default: null,
    },
    local: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    salaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgendaSala",
      default: null,
      index: true,
    },
    observacoes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    statusAgendamento: {
      type: String,
      enum: AGENDA_STATUS_LIST,
      default: "agendado",
      index: true,
    },
    statusPresenca: {
      type: String,
      enum: AGENDA_PRESENCA_STATUS_LIST,
      default: "pendente",
      index: true,
    },
    presencaObservacao: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    presencaJustificativaKey: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    presencaJustificativaLabel: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    presencaRegistradaEm: {
      type: Date,
      default: null,
    },
    presencaRegistradaPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    familiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Familia",
      default: null,
      index: true,
    },
    pacienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paciente",
      default: null,
      index: true,
    },
    responsavelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
    criadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    atualizadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    inativadoEm: {
      type: Date,
      default: null,
    },
    inativadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "AgendaEventos",
  }
);

AgendaEventoSchema.index({ salaId: 1, inicio: 1, ativo: 1 });

AgendaEventoSchema.plugin(mongoosePaginate);

module.exports = {
  AgendaEvento: mongoose.model("AgendaEvento", AgendaEventoSchema),
  TIPOS_AGENDA,
  AGENDA_ROOM_REQUIRED_TYPES,
  AGENDA_DEFAULT_DURATION_MINUTES,
  AGENDA_STATUS_LIST,
  AGENDA_PRESENCA_STATUS_LIST,
};
