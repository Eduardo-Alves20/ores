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

const REGISTRO_TIPOS = [
  "atendimento_geral",
  "entrevista_social",
  "relatorio_triagem",
  "anamnese",
  "relatorio_individual",
  "relatorio_evolucao",
  "relatorio_geral",
];

const VISIBILITY_SCOPES = ["owner_only", "care_team", "care_team_plus_admin"];

const AtendimentoSchema = new mongoose.Schema(
  {
    assistidoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assistido",
      required: false,
      index: true,
      default: null,
    },
    familiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Familia",
      required: false,
      index: true,
      default: null,
    },
    pacienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Paciente",
      required: false,
      index: true,
      default: null,
    },
    profissionalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
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
    notasPrivadas: {
      type: String,
      trim: true,
      maxlength: 8000,
      default: null,
    },
    registroTipo: {
      type: String,
      enum: REGISTRO_TIPOS,
      default: "atendimento_geral",
      index: true,
    },
    visibilityScope: {
      type: String,
      enum: VISIBILITY_SCOPES,
      default: "care_team",
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
      index: true,
    },
    careTeamIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Usuario",
      },
    ],
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
  REGISTRO_TIPOS,
  VISIBILITY_SCOPES,
};
