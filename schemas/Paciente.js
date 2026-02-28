const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const TIPOS_DEFICIENCIA = [
  "fisica",
  "intelectual",
  "auditiva",
  "visual",
  "multipla",
  "transtorno_espectro_autista",
  "outra",
];

const PacienteSchema = new mongoose.Schema(
  {
    familiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Familia",
      required: true,
      index: true,
    },
    nome: { type: String, required: true, trim: true, index: true },
    dataNascimento: { type: Date, required: false },
    tipoDeficiencia: {
      type: String,
      enum: TIPOS_DEFICIENCIA,
      default: "outra",
      index: true,
    },
    necessidadesApoio: { type: String, trim: true, maxlength: 3000 },
    observacoes: { type: String, trim: true, maxlength: 3000 },
    diagnosticoResumo: { type: String, trim: true, maxlength: 3000 },
    ativo: {
      type: Boolean,
      default: true,
      index: true,
    },
    criadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
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
    collection: "Pacientes",
  }
);

PacienteSchema.index({ nome: "text" });
PacienteSchema.plugin(mongoosePaginate);

module.exports = {
  Paciente: mongoose.model("Paciente", PacienteSchema),
  TIPOS_DEFICIENCIA,
};

