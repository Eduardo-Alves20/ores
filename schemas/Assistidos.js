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

const AssitidosSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    cpf: { type: String, required: true, unique: true, trim: true },
    telefone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    endereco: {
      type: EnderecoSchema,
      default: {},
    },
    nascimento: { type: Date },
  },
  {
    timestamps: true,
  }
);

AssitidosSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Assitidos", AssitidosSchema);