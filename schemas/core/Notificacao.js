const mongoose = require("mongoose");

const NOTIFICACAO_CANAIS = Object.freeze(["sistema", "email", "whatsapp"]);
const NOTIFICACAO_STATUS = Object.freeze(["pendente", "desabilitado", "enviado", "falha"]);

const NotificacaoSchema = new mongoose.Schema(
  {
    categoria: {
      type: String,
      trim: true,
      required: true,
      index: true,
      maxlength: 80,
    },
    evento: {
      type: String,
      trim: true,
      required: true,
      index: true,
      maxlength: 120,
    },
    canal: {
      type: String,
      enum: NOTIFICACAO_CANAIS,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: NOTIFICACAO_STATUS,
      default: "pendente",
      index: true,
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
      index: true,
    },
    destinatarioNome: {
      type: String,
      trim: true,
      default: "",
      maxlength: 140,
    },
    destinatarioEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: 180,
    },
    destinatarioTelefone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    titulo: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },
    mensagem: {
      type: String,
      trim: true,
      required: true,
      maxlength: 4000,
    },
    referenciaTipo: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    referenciaId: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    erroMensagem: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    tentativas: {
      type: Number,
      default: 0,
      min: 0,
    },
    enviadoEm: {
      type: Date,
      default: null,
    },
    lidoEm: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "Notificacoes",
  }
);

NotificacaoSchema.index({ usuarioId: 1, createdAt: -1 });
NotificacaoSchema.index({ referenciaTipo: 1, referenciaId: 1, createdAt: -1 });

module.exports = {
  Notificacao: mongoose.model("Notificacao", NotificacaoSchema),
  NOTIFICACAO_CANAIS,
  NOTIFICACAO_STATUS,
};
