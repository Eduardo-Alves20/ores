const { parseAgendaDate } = require("../../agendaAvailabilityService");
const { parseBoolean } = require("../../shared/valueParsingService");

function parseDateInput(value) {
  return parseAgendaDate(value);
}

function getMonthRange(query) {
  const inicioQuery = parseDateInput(query?.inicio);
  const fimQuery = parseDateInput(query?.fim);

  if (inicioQuery && fimQuery) {
    return { inicio: inicioQuery, fim: fimQuery };
  }

  const ref = parseDateInput(query?.referencia) || new Date();
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0);
  return { inicio, fim };
}

function sanitizeTitle(value) {
  return String(value || "").trim().slice(0, 140);
}

function sanitizeSalaNome(value) {
  return String(value || "").trim().slice(0, 120);
}

function sanitizeSalaDescricao(value) {
  return String(value || "").trim().slice(0, 240);
}

function isProvided(value) {
  return typeof value !== "undefined" && value !== null && String(value).trim() !== "";
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

module.exports = {
  parseBoolean,
  parseDateInput,
  getMonthRange,
  sanitizeTitle,
  sanitizeSalaNome,
  sanitizeSalaDescricao,
  isProvided,
  isDuplicateKeyError,
};
