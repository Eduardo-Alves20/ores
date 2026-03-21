function parseStatus(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "pendente" || raw === "aprovado" || raw === "rejeitado") return raw;
  return fallback;
}

function parseTipo(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "familia" || raw === "voluntario" || raw === "orgao_publico") return raw;
  return fallback;
}

function parsePage(value, fallback = 1) {
  return Math.max(Number.parseInt(String(value || ""), 10) || fallback, 1);
}

function parseLimit(value, fallback = 20) {
  const allowed = new Set([10, 20, 50, 100]);
  const parsed = Number.parseInt(String(value || ""), 10);
  if (allowed.has(parsed)) return parsed;
  return fallback;
}

function resolveReturnTo(rawValue, fallbackPath) {
  const raw = String(rawValue || "").trim();
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  if (!raw.startsWith("/acessos/")) return fallbackPath;
  return raw;
}

module.exports = {
  parseStatus,
  parseTipo,
  parsePage,
  parseLimit,
  resolveReturnTo,
};
