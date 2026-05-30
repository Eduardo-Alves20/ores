const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const FAIXA_ETARIA = Object.freeze(["crianca", "adolescente", "adulto", "idoso"]);
const STATUS_CADASTRO = Object.freeze(["rascunho", "em_analise", "ativo", "inativo", "cancelado"]);
const SEXO_BIOLOGICO = Object.freeze(["masculino", "feminino", "intersexo", "nao_informado"]);
const COR_RACA = Object.freeze(["branco", "preto", "pardo", "amarelo", "indigena", "nao_informado"]);
const PARENTESCO = Object.freeze(["mae", "pai", "avo", "tio", "conjuge", "irmao", "cuidador", "outro"]);
const TIPO_MORADIA = Object.freeze(["propria", "alugada", "cedida", "ocupacao", "abrigo", "sem_moradia"]);
const PERMISSAO_CONTATO = Object.freeze(["qualquer_hora", "somente_manha", "somente_tarde", "nao_ligar"]);
// Nível de suporte (TEA / acompanhamento terapêutico): 1 = leve, 2 = moderado, 3 = elevado
const NIVEL_SUPORTE = Object.freeze(["1", "2", "3"]);

const ResponsavelSchema = new mongoose.Schema(
  {
    parentesco: { type: String, trim: true },
    nome: { type: String, trim: true },
    cpf: { type: String, trim: true },
    dataNascimento: { type: Date, default: null },
    telefone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    ePrincipalResponsavel: {
      type: String,
      enum: ["sim", "nao", "nao_sabe", null],
      default: null,
    },
  },
  { _id: false }
);

const ContatoEmergenciaSchema = new mongoose.Schema(
  {
    nome: { type: String, trim: true },
    telefone: { type: String, trim: true },
    vinculo: { type: String, trim: true },
    moraNaMesmaResidencia: { type: Boolean, default: null },
  },
  { _id: false }
);

const EnderecoSchema = new mongoose.Schema(
  {
    cep: { type: String, trim: true },
    logradouro: { type: String, trim: true },
    numero: { type: String, trim: true },
    complemento: { type: String, trim: true },
    pontoReferencia: { type: String, trim: true },
    bairro: { type: String, trim: true },
    cidade: { type: String, trim: true },
    estado: { type: String, trim: true },
    tipoMoradia: { type: String, trim: true, default: null },
    tempoMoradia: { type: String, trim: true },
    microarea: { type: String, trim: true },
  },
  { _id: false }
);

const AnexoSchema = new mongoose.Schema(
  {
    attachmentId: { type: String, required: true, trim: true },
    fieldName: { type: String, trim: true },
    categoria: { type: String, trim: true },
    originalName: { type: String, trim: true },
    mimeType: { type: String, trim: true, lowercase: true },
    extension: { type: String, trim: true, lowercase: true },
    size: { type: Number, min: 0, default: 0 },
    storageKey: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null,
    },
  },
  { _id: false }
);

const AssistidoSchema = new mongoose.Schema(
  {
    // Identificação pessoal
    nome: { type: String, required: true, trim: true, index: true },
    cpf: { type: String, trim: true, default: null },
    rg: { type: String, trim: true },
    orgaoEmissor: { type: String, trim: true },
    dataNascimento: { type: Date, default: null, index: true },
    faixaEtaria: { type: String, enum: [...FAIXA_ETARIA, null], default: null },
    sexoBiologico: { type: String, enum: [...SEXO_BIOLOGICO, null], default: null },
    corRaca: { type: String, enum: [...COR_RACA, null], default: null },
    suporte: { type: String, enum: [...NIVEL_SUPORTE, null], default: null },
    naturalidade: { type: String, trim: true },
    nacionalidade: { type: String, trim: true, default: "Brasileira" },

    // Contato
    telefonePrincipal: { type: String, trim: true },
    telefoneSecundario: { type: String, trim: true },
    isWhatsApp: { type: Boolean, default: null },
    email: { type: String, trim: true, lowercase: true },
    permissaoContato: { type: String, enum: [...PERMISSAO_CONTATO, null], default: null },

    // Responsável / guardião
    responsavel: { type: ResponsavelSchema, default: () => ({}) },

    // Contato de emergência
    contatoEmergencia: { type: ContatoEmergenciaSchema, default: () => ({}) },

    // Endereço
    endereco: { type: EnderecoSchema, default: () => ({}) },

    // Notas gerais
    diagnosticoResumo: { type: String, trim: true, maxlength: 2000 },
    observacoes: { type: String, trim: true, maxlength: 3000 },

    camposExtras: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

    // Controle do fluxo de cadastro em etapas
    status: {
      type: String,
      enum: STATUS_CADASTRO,
      default: "rascunho",
      index: true,
    },
    etapaConcluida: { type: Number, min: 0, max: 5, default: 0 },

    // Anexos
    anexos: { type: [AnexoSchema], default: [] },

    // Soft-delete e auditoria
    ativo: { type: Boolean, default: true, index: true },
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
    atualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
    inativadoEm: { type: Date, default: null },
    inativadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
  },
  {
    timestamps: true,
    collection: "Assistidos",
  }
);

AssistidoSchema.index({
  nome: "text",
  cpf: "text",
  telefonePrincipal: "text",
  email: "text",
});

AssistidoSchema.plugin(mongoosePaginate);

module.exports = {
  Assistido: mongoose.model("Assistido", AssistidoSchema),
  FAIXA_ETARIA,
  STATUS_CADASTRO,
  SEXO_BIOLOGICO,
  COR_RACA,
  PARENTESCO,
  TIPO_MORADIA,
  PERMISSAO_CONTATO,
  NIVEL_SUPORTE,
};
