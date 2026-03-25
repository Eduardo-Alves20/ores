const mongoose = require("mongoose");

const CUSTOM_FIELD_TYPES = Object.freeze([
  "texto",
  "textarea",
  "numero",
  "data",
  "select",
  "booleano",
]);

const CUSTOM_FIELD_AREAS = Object.freeze([
  "familia",
  "usuario",
]);

const QUICK_FILTER_AREAS = Object.freeze([
  "assistidos_familias",
  "acessos_familias",
  "acessos_voluntarios",
  "agenda_presencas",
]);

const PRESENCA_JUSTIFICATIVA_STATUSES = Object.freeze([
  "falta",
  "falta_justificada",
  "cancelado_antecipadamente",
]);

const CAMPANHA_ANIVERSARIO_STATUSES = Object.freeze([
  "rascunho",
  "ativa",
  "pausada",
  "encerrada",
]);

const CAMPANHA_ANIVERSARIO_PUBLICOS = Object.freeze([
  "familia",
  "voluntario",
  "orgao_publico",
]);

const CAMPANHA_ANIVERSARIO_CANAIS = Object.freeze([
  "sistema",
  "whatsapp",
  "email",
]);

const CAMPANHA_ANIVERSARIO_ACOES = Object.freeze([
  "exibir_dashboard",
  "mensagem_sistema",
  "whatsapp",
  "email",
]);

const PresencaJustificativaSchema = new mongoose.Schema(
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
      trim: true,
      maxlength: 160,
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: 320,
      default: "",
    },
    aplicaEm: {
      type: [String],
      enum: PRESENCA_JUSTIFICATIVA_STATUSES,
      default: ["falta_justificada"],
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    ordem: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const CampoCustomizadoSchema = new mongoose.Schema(
  {
    area: {
      type: String,
      enum: CUSTOM_FIELD_AREAS,
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    chave: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    chaveNormalizada: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    tipo: {
      type: String,
      enum: CUSTOM_FIELD_TYPES,
      default: "texto",
    },
    placeholder: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    ajuda: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    obrigatorio: {
      type: Boolean,
      default: false,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    ordem: {
      type: Number,
      default: 0,
    },
    opcoes: {
      type: [String],
      default: [],
    },
  },
  {
    _id: true,
  }
);

const FiltroRapidoSchema = new mongoose.Schema(
  {
    area: {
      type: String,
      enum: QUICK_FILTER_AREAS,
      required: true,
      index: true,
    },
    nome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },
    campo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    valor: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    valorLabel: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    destaque: {
      type: Boolean,
      default: false,
    },
    ordem: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: true,
  }
);

const CampanhaAniversarioMensagemCanalSchema = new mongoose.Schema(
  {
    assunto: {
      type: String,
      trim: true,
      maxlength: 140,
      default: "",
    },
    aberturas: {
      type: [String],
      default: [],
    },
    mensagens: {
      type: [String],
      default: [],
    },
    fechamentos: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const CampanhaAniversarioSchema = new mongoose.Schema(
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
      trim: true,
      maxlength: 160,
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: 320,
      default: "",
    },
    status: {
      type: String,
      enum: CAMPANHA_ANIVERSARIO_STATUSES,
      default: "rascunho",
      index: true,
    },
    publico: {
      type: [String],
      enum: CAMPANHA_ANIVERSARIO_PUBLICOS,
      default: ["familia", "voluntario"],
    },
    diasAntecedencia: {
      type: Number,
      default: 7,
      min: 0,
      max: 30,
    },
    acaoPrimaria: {
      type: String,
      enum: CAMPANHA_ANIVERSARIO_ACOES,
      default: "exibir_dashboard",
    },
    canais: {
      type: [String],
      enum: CAMPANHA_ANIVERSARIO_CANAIS,
      default: ["sistema"],
    },
    requerAprovacao: {
      type: Boolean,
      default: false,
    },
    prioridade: {
      type: Number,
      default: 0,
    },
    personalizacao: {
      variarPorPerfil: {
        type: Boolean,
        default: true,
      },
      variarPorHistorico: {
        type: Boolean,
        default: true,
      },
      evitarRepeticaoAnual: {
        type: Boolean,
        default: true,
      },
    },
    mensagens: {
      sistema: {
        type: CampanhaAniversarioMensagemCanalSchema,
        default: () => ({}),
      },
      whatsapp: {
        type: CampanhaAniversarioMensagemCanalSchema,
        default: () => ({}),
      },
      email: {
        type: CampanhaAniversarioMensagemCanalSchema,
        default: () => ({}),
      },
    },
  },
  {
    _id: true,
  }
);

const ConfiguracaoSistemaSchema = new mongoose.Schema(
  {
    chave: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      trim: true,
      maxlength: 32,
    },
    justificativasPresenca: {
      type: [PresencaJustificativaSchema],
      default: [],
    },
    camposCustomizados: {
      type: [CampoCustomizadoSchema],
      default: [],
    },
    filtrosRapidos: {
      type: [FiltroRapidoSchema],
      default: [],
    },
    campanhasAniversario: {
      type: [CampanhaAniversarioSchema],
      default: [],
    },
    atualizadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "ConfiguracoesSistema",
  }
);

module.exports = {
  ConfiguracaoSistema: mongoose.model("ConfiguracaoSistema", ConfiguracaoSistemaSchema),
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_AREAS,
  QUICK_FILTER_AREAS,
  PRESENCA_JUSTIFICATIVA_STATUSES,
  CAMPANHA_ANIVERSARIO_STATUSES,
  CAMPANHA_ANIVERSARIO_PUBLICOS,
  CAMPANHA_ANIVERSARIO_CANAIS,
  CAMPANHA_ANIVERSARIO_ACOES,
};
