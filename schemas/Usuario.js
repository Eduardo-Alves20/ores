const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { PERFIS_LIST, PERFIS } = require("../config/roles");

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
      enum: PERFIS_LIST,
      default: PERFIS.ATENDENTE,
    },

    tipoCadastro: {
      type: String,
      enum: ["voluntario", "familia"],
      default: "voluntario",
    },

    statusAprovacao: {
      type: String,
      enum: ["pendente", "aprovado", "rejeitado"],
      default: "pendente",
      index: true,
    },

    aprovadoEm: {
      type: Date,
      default: null,
    },

    aprovadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },

    motivoAprovacao: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    ativo: {
      type: Boolean,
      default: true,
    },

    ultimoLoginEm: {
      type: Date,
      default: null,
    },

    ultimoLoginIp: {
      type: String,
      trim: true,
      default: null,
    },

    tentativasLogin: {
      type: Number,
      default: 0,
    },

    bloqueadoAte: {
      type: Date,
      default: null,
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
  }
);

UsuarioSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Usuario", UsuarioSchema);
