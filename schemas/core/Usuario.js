const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { PERFIS_LIST, PERFIS } = require("../../config/roles");
const { VOLUNTARIO_ACCESS_LEVELS } = require("../../config/volunteerAccess");
const { APPROVAL_ROLES } = require("../../config/approvalRoles");

const ProtectedAssetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      trim: true,
      required: true,
    },
    kind: {
      type: String,
      enum: ["documentoIdentidade", "fotoPerfil"],
      required: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
    },
    originalName: {
      type: String,
      trim: true,
      required: true,
    },
    mimeType: {
      type: String,
      trim: true,
      required: true,
    },
    extension: {
      type: String,
      trim: true,
      required: true,
    },
    size: {
      type: Number,
      min: 0,
      required: true,
    },
    storageKey: {
      type: String,
      trim: true,
      required: true,
    },
    ivHex: {
      type: String,
      trim: true,
      required: true,
    },
    authTagHex: {
      type: String,
      trim: true,
      required: true,
    },
    sha256: {
      type: String,
      trim: true,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadedBy: {
      type: String,
      trim: true,
      default: null,
    },
    ownerId: {
      type: String,
      trim: true,
      default: null,
    },
    purpose: {
      type: String,
      trim: true,
      default: "",
    },
    encryptionAlgorithm: {
      type: String,
      trim: true,
      default: "aes-256-gcm",
    },
  },
  {
    _id: false,
  }
);

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

    dataNascimento: {
      type: Date,
      default: null,
    },

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
      enum: ["voluntario", "familia", "orgao_publico"],
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

    dadosCadastro: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    anexosProtegidos: {
      documentoIdentidade: {
        type: ProtectedAssetSchema,
        default: null,
      },
      fotoPerfil: {
        type: ProtectedAssetSchema,
        default: null,
      },
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

    authVersion: {
      type: Number,
      default: 0,
      min: 0,
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

