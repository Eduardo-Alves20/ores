const { Assistido } = require("../../../schemas/social/Assistido");
const { FichaAnamnese } = require("../../../schemas/social/FichaAnamnese");
const { EntrevistaSocial } = require("../../../schemas/social/EntrevistaSocial");
const { createAssistidoError } = require("./assistidoContextService");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");

async function listarAssistidos({ query = {} } = {}) {
  const {
    busca,
    status,
    ativo,
    cidade,
    faixaEtaria,
    page = 1,
    limit = 20,
  } = query;

  const filtro = {};

  if (typeof ativo !== "undefined") {
    filtro.ativo = String(ativo) !== "false";
  } else {
    filtro.ativo = true;
  }

  if (status) {
    filtro.status = status;
  }

  if (cidade) {
    filtro["endereco.cidade"] = new RegExp(String(cidade).trim(), "i");
  }

  if (faixaEtaria) {
    filtro.faixaEtaria = faixaEtaria;
  }

  if (busca) {
    filtro.$text = { $search: String(busca).trim() };
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));

  const resultado = await Assistido.paginate(filtro, {
    page: pageNum,
    limit: limitNum,
    sort: { createdAt: -1 },
    select: "nome cpf telefonePrincipal email dataNascimento faixaEtaria status etapaConcluida ativo createdAt",
  });

  return resultado;
}

async function detalharAssistido({ assistidoId }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  const assistido = await Assistido.findById(id);
  if (!assistido) throw createAssistidoError("Assistido não encontrado.", 404);

  const [anamneseAtual, entrevistaAtual] = await Promise.all([
    FichaAnamnese.findOne({ assistidoId: id }).sort({ versao: -1 }),
    EntrevistaSocial.findOne({ assistidoId: id }).sort({ versao: -1 }),
  ]);

  return {
    assistido,
    anamneseAtual,
    entrevistaAtual,
  };
}

async function listarVersionsAnamnese({ assistidoId }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  return FichaAnamnese.find({ assistidoId: id })
    .sort({ versao: -1 })
    .select("versao faixaEtaria queixaPrincipal criadoPor createdAt updatedAt");
}

async function listarVersionsEntrevista({ assistidoId }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  return EntrevistaSocial.find({ assistidoId: id })
    .sort({ versao: -1 })
    .select("versao dataEntrevista local criadoPor createdAt updatedAt");
}

module.exports = {
  listarAssistidos,
  detalharAssistido,
  listarVersionsAnamnese,
  listarVersionsEntrevista,
};
