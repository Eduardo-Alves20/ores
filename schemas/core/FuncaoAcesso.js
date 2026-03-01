const mongoose = require("mongoose");

const FuncaoAcessoSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 90,
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    permissoes: {
      type: [String],
      default: [],
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("FuncaoAcesso", FuncaoAcessoSchema);
