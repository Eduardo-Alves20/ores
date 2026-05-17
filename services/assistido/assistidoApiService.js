// Facade: ponto único de entrada para o controller
const {
  criarAssistido,
  salvarDadosPessoais,
  salvarEndereco,
  confirmarCadastro,
  alterarStatusAssistido,
  uploadAnexosAssistido,
  abrirAnexoAssistido,
} = require("./api/assistidoActionService");

const {
  listarAssistidos,
  detalharAssistido,
  listarVersionsAnamnese,
  listarVersionsEntrevista,
} = require("./api/assistidoQueryService");

const {
  criarAnamnese,
  buscarAnamneseAtual,
  buscarAnamnese,
} = require("./api/anamneseService");

const {
  criarEntrevista,
  buscarEntrevistaAtual,
  buscarEntrevista,
} = require("./api/entrevistaService");

function getActorId(req) {
  return String(req?.session?.user?.id || "");
}

function getSessionUser(req) {
  return req?.session?.user || null;
}

module.exports = {
  getActorId,
  getSessionUser,

  // Assistido
  criarAssistido,
  salvarDadosPessoais,
  salvarEndereco,
  confirmarCadastro,
  alterarStatusAssistido,
  uploadAnexosAssistido,
  abrirAnexoAssistido,

  // Query
  listarAssistidos,
  detalharAssistido,
  listarVersionsAnamnese,
  listarVersionsEntrevista,

  // Anamnese
  criarAnamnese,
  buscarAnamneseAtual,
  buscarAnamnese,

  // Entrevista
  criarEntrevista,
  buscarEntrevistaAtual,
  buscarEntrevista,
};
