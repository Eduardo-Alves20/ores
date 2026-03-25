const { parseBoolean } = require("../shared/valueParsingService");
const { escapeRegex } = require("../shared/searchUtilsService");

const MAX_USER_SEARCH_LENGTH = 100;

function normalizeUserListOptions(input = {}) {
  return {
    page: Math.max(Number(input.page) || 1, 1),
    limit: Math.min(Math.max(Number(input.limit) || 10, 1), 100),
    busca: String(input.busca || "").trim().slice(0, MAX_USER_SEARCH_LENGTH),
    ativo: parseBoolean(input.ativo),
    perfil: input.perfil,
    tipoCadastro: input.tipoCadastro,
    statusAprovacao: input.statusAprovacao,
    sort: input.sort || "-createdAt",
  };
}

function buildUserListFilter(filters = {}) {
  const filtro = {};

  if (filters.busca) {
    const rx = new RegExp(escapeRegex(filters.busca), "i");
    filtro.$or = [
      { nome: { $regex: rx } },
      { email: { $regex: rx } },
      { login: { $regex: rx } },
      { cpf: { $regex: rx } },
    ];
  }

  if (typeof filters.ativo !== "undefined") {
    filtro.ativo = filters.ativo;
  }

  if (filters.perfil) {
    filtro.perfil = filters.perfil;
  }

  if (filters.tipoCadastro) {
    filtro.tipoCadastro = filters.tipoCadastro;
  }

  if (filters.statusAprovacao) {
    filtro.statusAprovacao = filters.statusAprovacao;
  }

  return filtro;
}

module.exports = {
  MAX_USER_SEARCH_LENGTH,
  buildUserListFilter,
  normalizeUserListOptions,
};
