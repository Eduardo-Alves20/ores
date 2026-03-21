function parseDateInput(value, fallback = null) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? fallback : dt;
}

function parseMonthInput(value, fallbackDate = new Date()) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split("-").map((part) => Number.parseInt(part, 10));
    if (year >= 2000 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1, 12, 0, 0, 0);
    }
  }

  const fallback = new Date(fallbackDate);
  if (Number.isNaN(fallback.getTime())) {
    return new Date();
  }

  return new Date(fallback.getFullYear(), fallback.getMonth(), 1, 12, 0, 0, 0);
}

function toDateInputValue(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthInputValue(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toTimeLabel(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function toLongDateLabel(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(dt);
}

function toMonthLabel(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(dt);
}

function toWeekLabel(startDate) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return "-";
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(start);
  const endLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(end);
  return `${startLabel} - ${endLabel}`;
}

function getWeekStart(dateLike) {
  const base = new Date(dateLike);
  if (Number.isNaN(base.getTime())) return null;
  const normalized = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getMonthRange(dateLike) {
  const base = new Date(dateLike);
  if (Number.isNaN(base.getTime())) return { start: null, end: null };
  const start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function sameMonth(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

module.exports = {
  parseDateInput,
  parseMonthInput,
  toDateInputValue,
  toMonthInputValue,
  toTimeLabel,
  toLongDateLabel,
  toMonthLabel,
  toWeekLabel,
  getWeekStart,
  getMonthRange,
  sameMonth,
};
