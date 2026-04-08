const mongoose = require("mongoose");

const ContadorSistemaSchema = new mongoose.Schema(
  {
    chave: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    ano: {
      type: Number,
      required: true,
      min: 1900,
      max: 9999,
      index: true,
    },
    valor: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "ContadoresSistema",
  }
);

ContadorSistemaSchema.index({ chave: 1, ano: 1 }, { unique: true });

module.exports = {
  ContadorSistema: mongoose.model("ContadorSistema", ContadorSistemaSchema),
};
