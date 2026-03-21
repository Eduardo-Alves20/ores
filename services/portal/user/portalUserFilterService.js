const { TIPOS_ATENDIMENTO } = require("../../../schemas/social/Atendimento");
const {
  USER_FAMILIA_LIMIT_OPTIONS,
  buildTipoAtendimentoOptions,
} = require("./portalUserFormattingService");

function parseFiltroTipo(raw) {
  const value = String(raw || "todos").toLowerCase().trim();
  if (TIPOS_ATENDIMENTO.includes(value)) return value;
  return "todos";
}

function parseFiltroStatus(raw) {
  const value = String(raw || "todos").toLowerCase().trim();
  if (value === "ativo" || value === "inativo") return value;
  return "todos";
}

function parseFiltroDate(raw) {
  const value = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value;
}

function parseFiltroLimit(raw) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (USER_FAMILIA_LIMIT_OPTIONS.includes(parsed)) return parsed;
  return 18;
}

function buildFamilyFilters(query = {}) {
  const filters = {
    busca: String(query?.busca || "").trim(),
    tipo: parseFiltroTipo(query?.tipo),
    status: parseFiltroStatus(query?.status),
    dataInicio: parseFiltroDate(query?.dataInicio),
    dataFim: parseFiltroDate(query?.dataFim),
    limit: parseFiltroLimit(query?.limit),
    limitOptions: USER_FAMILIA_LIMIT_OPTIONS,
    tiposOptions: buildTipoAtendimentoOptions(),
  };

  if (filters.dataInicio && filters.dataFim && filters.dataInicio > filters.dataFim) {
    const aux = filters.dataInicio;
    filters.dataInicio = filters.dataFim;
    filters.dataFim = aux;
  }

  return filters;
}

module.exports = {
  buildFamilyFilters,
};
