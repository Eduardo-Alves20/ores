const mongoose = require("mongoose");

function normalizeSalaKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

const AgendaSalaSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    nomeNormalizado: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
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
    collection: "AgendaSalas",
  }
);

AgendaSalaSchema.pre("validate", function setNomeNormalizado() {
  const normalized = normalizeSalaKey(this.nome);
  if (!normalized) {
    this.invalidate("nome", "Nome da sala e obrigatorio.");
  } else {
    this.nomeNormalizado = normalized;
  }
});

module.exports = {
  AgendaSala: mongoose.model("AgendaSala", AgendaSalaSchema),
  normalizeSalaKey,
};
