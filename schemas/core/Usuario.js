const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { PERFIS_LIST, PERFIS } = require("../../config/roles");
const { VOLUNTARIO_ACCESS_LEVELS } = require("../../config/volunteerAccess");
const { APPROVAL_ROLES } = require("../../config/approvalRoles");

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

    login: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    senha: { type: String, required: true, select: false },

    telefone: { type: String, trim: true },

    cpf: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // permite vÃ¡rios docs sem cpf
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

    nivelAcessoVoluntario: {
      type: String,
      enum: [...Object.values(VOLUNTARIO_ACCESS_LEVELS), null],
      default: null,
    },

    funcoesAcesso: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FuncaoAcesso",
      },
    ],

    papelAprovacao: {
      type: String,
      enum: Object.values(APPROVAL_ROLES),
      default: APPROVAL_ROLES.MEMBRO,
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
    camposExtras: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    votosAprovacao: [
      {
        _id: false,
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Usuario",
          required: true,
        },
        decisao: {
          type: String,
          enum: ["aprovar", "rejeitar"],
          required: true,
        },
        motivo: {
          type: String,
          trim: true,
          default: "",
          maxlength: 500,
        },
        nivelAcessoVoluntario: {
          type: String,
          enum: [...Object.values(VOLUNTARIO_ACCESS_LEVELS), null],
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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

