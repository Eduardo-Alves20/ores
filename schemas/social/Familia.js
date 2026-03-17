const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const EnderecoSchema = new mongoose.Schema(
  {
    cep: { type: String, trim: true },
    rua: { type: String, trim: true },
    numero: { type: String, trim: true },
    bairro: { type: String, trim: true },
    cidade: { type: String, trim: true },
    estado: { type: String, trim: true },
    complemento: { type: String, trim: true },
  },
  { _id: false }
);

const ResponsavelSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    parentesco: { type: String, trim: true, default: "responsavel" },
    telefone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const FamiliaSchema = new mongoose.Schema(
  {
    responsavel: {
      type: ResponsavelSchema,
      required: true,
    },
    endereco: {
      type: EnderecoSchema,
      default: {},
    },
    observacoes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    camposExtras: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
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
    collection: "Familias",
  }
);

FamiliaSchema.index({ "responsavel.nome": "text", "responsavel.telefone": "text", "responsavel.email": "text" });

FamiliaSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Familia", FamiliaSchema);
