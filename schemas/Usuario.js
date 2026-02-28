const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const UsuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    senha: { type: String, required: true, select: false },

    telefone: { type: String, trim: true },

    cpf: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // permite vários docs sem cpf
    },

    perfil: {
      type: String,
      enum: ["admin", "usuario"],
      default: "usuario",
    },

    ativo: {
      type: Boolean,
      default: true,
    },

    ultimoLoginEm: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

UsuarioSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Usuario", UsuarioSchema);