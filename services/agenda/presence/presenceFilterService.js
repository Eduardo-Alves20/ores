const { PRESENCA_LABELS } = require("./presenceConstants");

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function parsePresenceStatusFilter(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (
    [
      "todos",
      "pendente",
      "presente",
      "falta",
      "falta_justificada",
      "cancelado_antecipadamente",
    ].includes(raw)
  ) {
    return raw;
  }
  return fallback;
}

function matchesPresenceFilters(evento, filtros = {}) {
  const statusFilter = String(filtros?.statusPresenca || "todos").trim().toLowerCase();
  const currentStatus = String(evento?.statusPresenca || "pendente").trim().toLowerCase();
  if (statusFilter !== "todos" && currentStatus !== statusFilter) {
    return false;
  }

  const searchTerm = normalizeSearchText(filtros?.buscaUsuario || "");
  if (!searchTerm) {
    return true;
  }

  const haystack = normalizeSearchText(
    [
      evento?.titulo,
      evento?.observacoes,
      evento?.presencaObservacao,
      evento?.pacienteId?.nome,
      evento?.familiaId?.responsavel?.nome,
      evento?.responsavelId?.nome,
      evento?.salaId?.nome,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(searchTerm);
}

function buildFilterSummary(filtros = {}, profissionais = []) {
  const chips = [];
  const start = String(filtros?.dataInicio || "").trim();
  const end = String(filtros?.dataFim || "").trim();
  const month = String(filtros?.mes || "").trim();
  const status = String(filtros?.statusPresenca || "todos").trim();
  const busca = String(filtros?.buscaUsuario || "").trim();
  const responsavelId = String(filtros?.responsavelId || "").trim();

  if (start || end) {
    chips.push({
      tone: "neutral",
      label: `Periodo: ${start || "-"} ate ${end || "-"}`,
    });
  }

  if (month) {
    chips.push({
      tone: "neutral",
      label: `Mes: ${month}`,
    });
  }

  if (status && status !== "todos") {
    chips.push({
      tone:
        status === "presente"
          ? "success"
          : status === "falta"
            ? "danger"
            : status === "falta_justificada"
              ? "warning"
              : "info",
      label: `Status: ${PRESENCA_LABELS[status] || status}`,
    });
  }

  if (responsavelId) {
    const professional = (Array.isArray(profissionais) ? profissionais : []).find(
      (item) => String(item?._id || "") === responsavelId
    );
    chips.push({
      tone: "neutral",
      label: `Profissional: ${professional?.nome || "Selecionado"}`,
    });
  }

  if (busca) {
    chips.push({
      tone: "info",
      label: `Busca: ${busca}`,
    });
  }

  return chips;
}

function parseSelectOption(value, allowedValues, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  return Array.isArray(allowedValues) && allowedValues.includes(raw) ? raw : fallback;
}

function parseNumericChoice(value, allowedValues, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Array.isArray(allowedValues) && allowedValues.includes(parsed) ? parsed : fallback;
}

function parseBooleanFlag(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["1", "true", "sim", "yes", "on"].includes(raw);
}

function buildBasePresenceQuery(filtros = {}) {
  const params = new URLSearchParams();
  const candidates = {
    dataInicio: filtros?.dataInicio || "",
    dataFim: filtros?.dataFim || "",
    mes: filtros?.mes || "",
    dia: filtros?.dia || "",
    responsavelId: filtros?.responsavelId || "",
    statusPresenca: filtros?.statusPresenca || "todos",
  };

  Object.entries(candidates).forEach(([key, value]) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    if (key === "statusPresenca" && normalized === "todos") return;
    params.set(key, normalized);
  });

  return params.toString();
}

module.exports = {
  parsePresenceStatusFilter,
  matchesPresenceFilters,
  buildFilterSummary,
  parseSelectOption,
  parseNumericChoice,
  parseBooleanFlag,
  buildBasePresenceQuery,
};
