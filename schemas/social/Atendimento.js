const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TIPOS_ATENDIMENTO = [
  "ligacao",
  "presencial",
  "mensagem",
  "whatsapp",
  "videochamada",
  "outro",
];

const AtendimentoSchema = new mongoose.Schema(
  {
    familiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Familia",
      required: true,
      index: true,
    },
    pacienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paciente",
      required: false,
      index: true,
      default: null,
    },
    dataHora: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    tipo: {
      type: String,
      enum: TIPOS_ATENDIMENTO,
      required: true,
      default: "outro",
      index: true,
    },
    resumo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    proximosPassos: {
      type: String,
      trim: true,
      maxlength: 4000,
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
    collection: "Atendimentos",
  }
);

AtendimentoSchema.plugin(mongoosePaginate);

module.exports = {
  Atendimento: mongoose.model("Atendimento", AtendimentoSchema),
  TIPOS_ATENDIMENTO,
};

