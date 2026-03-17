const mongoose = require("mongoose");

const AGENDA_HISTORICO_TIPOS = Object.freeze([
  "agendamento_criado",
  "agendamento_atualizado",
  "agendamento_movido",
  "agendamento_status_alterado",
  "presenca_registrada",
]);

const AgendaHistoricoSchema = new mongoose.Schema(
  {
    eventoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgendaEvento",
      required: true,
      index: true,
    },
    atorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
    atorNome: {
      type: String,
      trim: true,
      default: "",
      maxlength: 140,
    },
    atorPerfil: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    tipo: {
      type: String,
      enum: AGENDA_HISTORICO_TIPOS,
      required: true,
      index: true,
    },
    visibilidade: {
      type: String,
      enum: ["interna", "familiar", "todos"],
      default: "interna",
      index: true,
    },
    titulo: {
      type: String,
      trim: true,
      required: true,
      maxlength: 140,
    },
    descricao: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    detalhes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "AgendaHistoricos",
  }
);

AgendaHistoricoSchema.index({ eventoId: 1, createdAt: -1 });

module.exports = {
  AgendaHistorico: mongoose.model("AgendaHistorico", AgendaHistoricoSchema),
  AGENDA_HISTORICO_TIPOS,
};
