const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TIPOS_AGENDA = [
  "visita_domiciliar",
  "atendimento_sede",
  "entrega_beneficio",
  "reuniao_equipe",
  "outro",
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
    observacoes: {
      type: String,
      trim: true,
      maxlength: 3000,
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

AgendaEventoSchema.plugin(mongoosePaginate);

module.exports = {
  AgendaEvento: mongoose.model("AgendaEvento", AgendaEventoSchema),
  TIPOS_AGENDA,
};

