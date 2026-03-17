const mongoose = require("mongoose");
const Usuario = require("../../schemas/core/Usuario");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../../services/accessControlService");
const {
  listPresenceReasons,
  listQuickFilters,
} = require("../../services/systemConfigService");

const PRESENCA_LABELS = Object.freeze({
  pendente: "Pendente",
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  cancelado_antecipadamente: "Cancelado antecipadamente",
});

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

function toDateTimeLabel(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(dt);
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

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || "").trim());
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
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

function buildPresenceCounters(events) {
  const counters = {
    total: 0,
    presente: 0,
    falta: 0,
    faltaJustificada: 0,
    pendente: 0,
    cancelado: 0,
  };

  (Array.isArray(events) ? events : []).forEach((evento) => {
    counters.total += 1;
    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") {
      counters.presente += 1;
    } else if (status === "falta") {
      counters.falta += 1;
    } else if (status === "falta_justificada") {
      counters.faltaJustificada += 1;
    } else if (status === "cancelado_antecipadamente") {
      counters.cancelado += 1;
    } else {
      counters.pendente += 1;
    }
  });

  return counters;
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

function buildSeries(events) {
  const buckets = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const weekStart = getWeekStart(evento?.inicio);
    if (!weekStart) return;
    const key = weekStart.toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: toWeekLabel(weekStart),
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
      });
    }

    const bucket = buckets.get(key);
    bucket.total += 1;

    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") bucket.presentes += 1;
    if (status === "falta") bucket.faltas += 1;
    if (status === "falta_justificada") bucket.justificadas += 1;
  });

  return Array.from(buckets.values())
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))
    .slice(-8);
}

function buildAssistidoRanking(events) {
  const map = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const pacienteId = String(evento?.pacienteId?._id || "");
    const familiaId = String(evento?.familiaId?._id || "");
    const key = pacienteId || familiaId || "sem-vinculo";
    const nome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";

    if (!map.has(key)) {
      map.set(key, {
        key,
        nome,
        familiaNome: evento?.familiaId?.responsavel?.nome || "-",
        total: 0,
        faltas: 0,
        justificadas: 0,
        presentes: 0,
        ultimaOcorrencia: evento?.inicio || null,
      });
    }

    const row = map.get(key);
    row.total += 1;
    row.ultimaOcorrencia = row.ultimaOcorrencia > evento?.inicio ? row.ultimaOcorrencia : evento?.inicio;

    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") row.presentes += 1;
    if (status === "falta") row.faltas += 1;
    if (status === "falta_justificada") row.justificadas += 1;
  });

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    })
    .slice(0, 10)
    .map((item) => ({
      ...item,
      ultimaOcorrenciaLabel: item.ultimaOcorrencia ? toDateTimeLabel(item.ultimaOcorrencia) : "-",
    }));
}

function buildProfissionalRanking(events) {
  const map = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const key = String(evento?.responsavelId?._id || "sem-responsavel");
    const nome = evento?.responsavelId?.nome || "Sem responsavel";

    if (!map.has(key)) {
      map.set(key, {
        key,
        nome,
        total: 0,
        faltas: 0,
        justificadas: 0,
        presentes: 0,
      });
    }

    const row = map.get(key);
    row.total += 1;
    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") row.presentes += 1;
    if (status === "falta") row.faltas += 1;
    if (status === "falta_justificada") row.justificadas += 1;
  });

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    })
    .slice(0, 10);
}

function buildUltimasOcorrencias(events) {
  return (Array.isArray(events) ? events : [])
    .filter((evento) => ["falta", "falta_justificada"].includes(String(evento?.statusPresenca || "").trim()))
    .sort((a, b) => new Date(b?.inicio || 0).getTime() - new Date(a?.inicio || 0).getTime())
    .slice(0, 20)
    .map((evento) => ({
      id: String(evento?._id || ""),
      dataHoraLabel: toDateTimeLabel(evento?.inicio),
      pacienteNome: evento?.pacienteId?.nome || "-",
      familiaNome: evento?.familiaId?.responsavel?.nome || "-",
      profissionalNome: evento?.responsavelId?.nome || "-",
      statusPresencaLabel: PRESENCA_LABELS[evento?.statusPresenca || "pendente"] || "Pendente",
      observacao: evento?.presencaObservacao || evento?.observacoes || "-",
      titulo: evento?.titulo || "Agendamento",
    }));
}

function buildCalendarDays(events, monthDate, selectedDayKey) {
  const monthBase = new Date(monthDate);
  const monthRange = getMonthRange(monthBase);
  const monthStart = monthRange?.start ? new Date(monthRange.start) : null;
  const monthEnd = monthRange?.end ? new Date(monthRange.end) : null;
  if (Number.isNaN(monthBase.getTime()) || !monthStart || !monthEnd) return [];

  const todayKey = toDateInputValue(new Date());
  const countersByDay = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const dayKey = toDateInputValue(evento?.inicio);
    if (!dayKey) return;

    if (!countersByDay.has(dayKey)) {
      countersByDay.set(dayKey, {
        total: 0,
        presente: 0,
        falta: 0,
        faltaJustificada: 0,
        pendente: 0,
        cancelado: 0,
      });
    }

    const bucket = countersByDay.get(dayKey);
    const current = buildPresenceCounters([evento]);
    bucket.total += current.total;
    bucket.presente += current.presente;
    bucket.falta += current.falta;
    bucket.faltaJustificada += current.faltaJustificada;
    bucket.pendente += current.pendente;
    bucket.cancelado += current.cancelado;
  });

  const leadingPlaceholders = monthStart.getDay();
  const trailingPlaceholders = (7 - ((leadingPlaceholders + monthEnd.getDate()) % 7)) % 7;
  const cells = [];

  for (let index = 0; index < leadingPlaceholders; index += 1) {
    cells.push({
      key: `placeholder-start-${index}`,
      isPlaceholder: true,
    });
  }

  for (let dayNumber = 1; dayNumber <= monthEnd.getDate(); dayNumber += 1) {
    const current = new Date(monthStart);
    current.setDate(dayNumber);
    const dayKey = toDateInputValue(current);
    const counters = countersByDay.get(dayKey) || {
      total: 0,
      presente: 0,
      falta: 0,
      faltaJustificada: 0,
      pendente: 0,
      cancelado: 0,
    };

    cells.push({
      key: dayKey,
      dayNumber: current.getDate(),
      inCurrentMonth: true,
      isPlaceholder: false,
      isToday: dayKey === todayKey,
      isSelected: dayKey === selectedDayKey,
      ...counters,
    });
  }

  for (let index = 0; index < trailingPlaceholders; index += 1) {
    cells.push({
      key: `placeholder-end-${index}`,
      isPlaceholder: true,
    });
  }

  return cells;
}

function mapDayEvents(events) {
  return (Array.isArray(events) ? events : [])
    .sort((a, b) => new Date(a?.inicio || 0).getTime() - new Date(b?.inicio || 0).getTime())
    .map((evento) => ({
      id: String(evento?._id || ""),
      titulo: evento?.titulo || "Agendamento",
      horaLabel: toTimeLabel(evento?.inicio),
      dataHoraLabel: toDateTimeLabel(evento?.inicio),
      pacienteNome: evento?.pacienteId?.nome || "-",
      familiaNome: evento?.familiaId?.responsavel?.nome || "-",
      profissionalNome: evento?.responsavelId?.nome || "-",
      salaNome: evento?.salaId?.nome || "-",
      statusPresenca: String(evento?.statusPresenca || "pendente").trim(),
      statusPresencaLabel: PRESENCA_LABELS[evento?.statusPresenca || "pendente"] || "Pendente",
      observacao: evento?.presencaObservacao || evento?.observacoes || "",
    }));
}

function buildPresenceStatusOptions() {
  return [
    { value: "todos", label: "Todos os status" },
    { value: "presente", label: "Somente presencas" },
    { value: "falta", label: "Somente faltas" },
    { value: "falta_justificada", label: "Somente justificadas" },
    { value: "pendente", label: "Somente pendentes" },
    { value: "cancelado_antecipadamente", label: "Somente cancelados" },
  ];
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

function buildCalendarControls(monthBase = new Date()) {
  const selected = new Date(monthBase);
  const selectedYear = selected.getFullYear();

  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const probe = new Date(selectedYear, index, 1);
    return {
      value: String(index + 1).padStart(2, "0"),
      label: new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(probe),
    };
  });

  const yearOptions = Array.from({ length: 7 }, (_, index) => selectedYear - 3 + index);

  return {
    monthOptions,
    yearOptions,
    selectedMonth: String(selected.getMonth() + 1).padStart(2, "0"),
    selectedYear: String(selectedYear),
  };
}

function toPercent(part, total) {
  const normalizedTotal = Number(total || 0);
  if (normalizedTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(part || 0) / normalizedTotal) * 100)));
}

function createPageError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
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

function getMostFrequentLabel(counterMap, fallback = "-") {
  if (!(counterMap instanceof Map) || counterMap.size === 0) return fallback;

  let topLabel = fallback;
  let topCount = -1;

  counterMap.forEach((count, label) => {
    if (Number(count || 0) > topCount) {
      topCount = Number(count || 0);
      topLabel = label;
    }
  });

  return topLabel || fallback;
}

function buildWeeklyRows(events) {
  const buckets = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const weekStart = getWeekStart(evento?.inicio);
    if (!weekStart) return;

    const key = weekStart.toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: toWeekLabel(weekStart),
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
        pendentes: 0,
        cancelados: 0,
        assistidoAusencias: new Map(),
      });
    }

    const row = buckets.get(key);
    row.total += 1;

    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") row.presentes += 1;
    else if (status === "falta") row.faltas += 1;
    else if (status === "falta_justificada") row.justificadas += 1;
    else if (status === "cancelado_antecipadamente") row.cancelados += 1;
    else row.pendentes += 1;

    if (["falta", "falta_justificada"].includes(status)) {
      const assistidoNome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";
      row.assistidoAusencias.set(
        assistidoNome,
        Number(row.assistidoAusencias.get(assistidoNome) || 0) + 1
      );
    }
  });

  return Array.from(buckets.values())
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))
    .map((row) => {
      const totalAusencias = Number(row.faltas || 0) + Number(row.justificadas || 0);
      return {
        ...row,
        totalAusencias,
        taxaComparecimento: toPercent(row.presentes, row.total),
        taxaAusencia: toPercent(totalAusencias, row.total),
        assistidoCriticoNome: getMostFrequentLabel(row.assistidoAusencias, "Sem recorrencia"),
        assistidoCriticoQtd: Number(
          row.assistidoAusencias.get(getMostFrequentLabel(row.assistidoAusencias, "")) || 0
        ),
      };
    });
}

function buildAssistidoRows(events) {
  const rows = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const pacienteId = String(evento?.pacienteId?._id || "");
    const familiaId = String(evento?.familiaId?._id || "");
    const key = pacienteId || familiaId || `evento:${String(evento?._id || "")}`;
    const nome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";
    const familiaNome = evento?.familiaId?.responsavel?.nome || "-";
    const profissionalNome = evento?.responsavelId?.nome || "Sem responsavel";
    const status = String(evento?.statusPresenca || "pendente").trim();
    const timestamp = new Date(evento?.inicio || 0).getTime();

    if (!rows.has(key)) {
      rows.set(key, {
        key,
        nome,
        familiaId,
        familiaNome,
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
        pendentes: 0,
        cancelados: 0,
        ultimaOcorrencia: null,
        ultimoStatus: "pendente",
        ultimoTimestamp: 0,
        ultimaAusencia: null,
        profissionaisMap: new Map(),
        timeline: [],
      });
    }

    const row = rows.get(key);
    row.total += 1;
    row.profissionaisMap.set(profissionalNome, Number(row.profissionaisMap.get(profissionalNome) || 0) + 1);
    row.timeline.push({ timestamp, status });

    if (timestamp >= row.ultimoTimestamp) {
      row.ultimoTimestamp = timestamp;
      row.ultimaOcorrencia = evento?.inicio || null;
      row.ultimoStatus = status;
    }

    if (["falta", "falta_justificada"].includes(status) && timestamp >= new Date(row.ultimaAusencia || 0).getTime()) {
      row.ultimaAusencia = evento?.inicio || null;
    }

    if (status === "presente") row.presentes += 1;
    else if (status === "falta") row.faltas += 1;
    else if (status === "falta_justificada") row.justificadas += 1;
    else if (status === "cancelado_antecipadamente") row.cancelados += 1;
    else row.pendentes += 1;
  });

  return Array.from(rows.values())
    .map((row) => {
      const timeline = [...row.timeline].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      let sequenciaAusencias = 0;

      for (const item of timeline) {
        if (["falta", "falta_justificada"].includes(String(item?.status || ""))) {
          sequenciaAusencias += 1;
          continue;
        }
        break;
      }

      const totalAusencias = Number(row.faltas || 0) + Number(row.justificadas || 0);

      return {
        ...row,
        totalAusencias,
        profissionalPrincipal: getMostFrequentLabel(row.profissionaisMap, "-"),
        taxaComparecimento: toPercent(row.presentes, row.total),
        taxaAusencia: toPercent(totalAusencias, row.total),
        sequenciaAusencias,
        ultimaOcorrenciaLabel: row.ultimaOcorrencia ? toDateTimeLabel(row.ultimaOcorrencia) : "-",
        ultimaAusenciaLabel: row.ultimaAusencia ? toDateTimeLabel(row.ultimaAusencia) : "-",
        ultimoStatusLabel: PRESENCA_LABELS[row.ultimoStatus || "pendente"] || "Pendente",
      };
    })
    .sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });
}

function buildProfissionalRows(events) {
  const rows = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const key = String(evento?.responsavelId?._id || "sem-responsavel");
    const nome = evento?.responsavelId?.nome || "Sem responsavel";
    const status = String(evento?.statusPresenca || "pendente").trim();
    const timestamp = new Date(evento?.inicio || 0).getTime();
    const assistidoNome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";

    if (!rows.has(key)) {
      rows.set(key, {
        key,
        nome,
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
        pendentes: 0,
        cancelados: 0,
        ultimaOcorrencia: null,
        ultimoTimestamp: 0,
        assistidoAusencias: new Map(),
      });
    }

    const row = rows.get(key);
    row.total += 1;

    if (timestamp >= row.ultimoTimestamp) {
      row.ultimoTimestamp = timestamp;
      row.ultimaOcorrencia = evento?.inicio || null;
    }

    if (status === "presente") row.presentes += 1;
    else if (status === "falta") row.faltas += 1;
    else if (status === "falta_justificada") row.justificadas += 1;
    else if (status === "cancelado_antecipadamente") row.cancelados += 1;
    else row.pendentes += 1;

    if (["falta", "falta_justificada"].includes(status)) {
      row.assistidoAusencias.set(
        assistidoNome,
        Number(row.assistidoAusencias.get(assistidoNome) || 0) + 1
      );
    }
  });

  return Array.from(rows.values())
    .map((row) => {
      const totalAusencias = Number(row.faltas || 0) + Number(row.justificadas || 0);
      const assistidoCritico = getMostFrequentLabel(row.assistidoAusencias, "Sem recorrencia");
      return {
        ...row,
        totalAusencias,
        taxaComparecimento: toPercent(row.presentes, row.total),
        taxaAusencia: toPercent(totalAusencias, row.total),
        assistidoCritico,
        assistidoCriticoQtd: Number(row.assistidoAusencias.get(assistidoCritico) || 0),
        ultimaOcorrenciaLabel: row.ultimaOcorrencia ? toDateTimeLabel(row.ultimaOcorrencia) : "-",
      };
    })
    .sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });
}

function buildOccurrenceRows(events) {
  return (Array.isArray(events) ? events : [])
    .slice()
    .sort((a, b) => new Date(b?.inicio || 0).getTime() - new Date(a?.inicio || 0).getTime())
    .map((evento) => {
      const statusPresenca = String(evento?.statusPresenca || "pendente").trim();
      return {
        id: String(evento?._id || ""),
        dataHoraLabel: toDateTimeLabel(evento?.inicio),
        dia: toDateInputValue(evento?.inicio),
        pacienteNome: evento?.pacienteId?.nome || "-",
        familiaId: String(evento?.familiaId?._id || ""),
        familiaNome: evento?.familiaId?.responsavel?.nome || "-",
        profissionalNome: evento?.responsavelId?.nome || "-",
        salaNome: evento?.salaId?.nome || "-",
        statusPresenca,
        statusPresencaLabel: PRESENCA_LABELS[statusPresenca] || "Pendente",
        observacao: String(evento?.presencaObservacao || evento?.observacoes || "").trim(),
        hasObservacao: Boolean(String(evento?.presencaObservacao || evento?.observacoes || "").trim()),
        titulo: evento?.titulo || "Agendamento",
      };
    });
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

async function loadProfissionaisOptions(canViewAll) {
  if (!canViewAll) return [];

  return Usuario.find({
    ativo: true,
    perfil: { $in: [PERFIS.SUPERADMIN, PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO] },
  })
    .select("_id nome perfil")
    .sort({ nome: 1 })
    .lean();
}

async function loadPresenceContext(req) {
  const user = req?.session?.user || null;
  const permissionList = user?.permissions || [];
  const canViewAll = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const userObjectId = isValidObjectId(user?.id) ? new mongoose.Types.ObjectId(String(user.id)) : null;

  if (!canViewAll && !userObjectId) {
    throw createPageError(403, "Voce nao possui escopo valido para visualizar esse painel.");
  }

  const today = new Date();
  const monthBase = parseMonthInput(req.query?.mes, today);
  const monthRange = getMonthRange(monthBase);
  const hasExplicitStart = String(req.query?.dataInicio || "").trim().length > 0;
  const hasExplicitEnd = String(req.query?.dataFim || "").trim().length > 0;

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  let defaultDataFim = new Date(hoje);
  let defaultDataInicio = new Date(hoje);
  defaultDataInicio.setDate(defaultDataInicio.getDate() - 29);
  defaultDataInicio.setHours(0, 0, 0, 0);

  if ((!hasExplicitStart || !hasExplicitEnd) && monthRange.start && monthRange.end && String(req.query?.mes || "").trim()) {
    defaultDataInicio = new Date(monthRange.start);
    defaultDataFim = new Date(monthRange.end);
  }

  const dataFim = parseDateInput(req.query?.dataFim, defaultDataFim);
  const dataInicio = parseDateInput(req.query?.dataInicio, defaultDataInicio);

  if (!dataInicio || !dataFim || dataInicio > dataFim) {
    throw createPageError(400, "Periodo de presenca invalido.");
  }

  const diffDays = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 366) {
    throw createPageError(400, "O periodo maximo do relatorio de presenca e de 366 dias.");
  }

  const filtros = {
    dataInicio: toDateInputValue(dataInicio),
    dataFim: toDateInputValue(dataFim),
    mes: toMonthInputValue(monthBase),
    dia: "",
    responsavelId: "",
    statusPresenca: parsePresenceStatusFilter(req.query?.statusPresenca, "todos"),
    buscaUsuario: String(req.query?.buscaUsuario || "").trim().slice(0, 100),
  };

  const query = {
    ativo: true,
    inicio: {
      $gte: new Date(`${filtros.dataInicio}T00:00:00`),
      $lte: new Date(`${filtros.dataFim}T23:59:59.999`),
    },
  };

  if (canViewAll && isValidObjectId(req.query?.responsavelId)) {
    filtros.responsavelId = String(req.query.responsavelId);
    query.responsavelId = new mongoose.Types.ObjectId(filtros.responsavelId);
  } else if (!canViewAll) {
    query.responsavelId = userObjectId;
  }

  const [profissionais, eventos] = await Promise.all([
    loadProfissionaisOptions(canViewAll),
    AgendaEvento.find(query)
      .populate("responsavelId", "_id nome")
      .populate("familiaId", "_id responsavel")
      .populate("pacienteId", "_id nome")
      .populate("salaId", "_id nome")
      .sort({ inicio: -1 })
      .lean(),
  ]);

  const filteredEvents = eventos.filter((evento) =>
    matchesPresenceFilters(evento, {
      statusPresenca: filtros.statusPresenca,
      buscaUsuario: filtros.buscaUsuario,
    })
  );

  const calendarEvents = filteredEvents.filter((evento) => {
    const eventDate = new Date(evento?.inicio);
    if (Number.isNaN(eventDate.getTime()) || !monthRange.start || !monthRange.end) return false;
    return eventDate >= monthRange.start && eventDate <= monthRange.end;
  });

  const selectedDayInput = parseDateInput(req.query?.dia, null);
  let selectedDay = selectedDayInput && sameMonth(selectedDayInput, monthBase) ? selectedDayInput : null;

  if (!selectedDay) {
    if (sameMonth(today, monthBase)) {
      selectedDay = today;
    } else if (calendarEvents.length > 0) {
      selectedDay = new Date(calendarEvents[calendarEvents.length - 1]?.inicio || monthRange.start);
    } else {
      selectedDay = monthRange.start || today;
    }
  }

  filtros.dia = toDateInputValue(selectedDay);

  const selectedDayEventsRaw = calendarEvents.filter(
    (evento) => toDateInputValue(evento?.inicio) === filtros.dia
  );

  const counters = buildPresenceCounters(filteredEvents);

  return {
    user,
    canViewAll,
    profissionais,
    filtros,
    monthBase,
    monthRange,
    filteredEvents,
    calendarEvents,
    selectedDay,
    selectedDayEventsRaw,
    counters,
    taxaComparecimento: counters.total > 0 ? Math.round((counters.presente / counters.total) * 100) : 0,
    baseQuery: buildBasePresenceQuery(filtros),
  };
}

function buildDetailSections(context) {
  const weeklyRows = buildWeeklyRows(context.filteredEvents);
  const assistidoRows = buildAssistidoRows(context.filteredEvents);
  const profissionalRows = buildProfissionalRows(context.filteredEvents);
  const occurrenceRows = buildOccurrenceRows(context.filteredEvents).filter((item) =>
    ["falta", "falta_justificada", "cancelado_antecipadamente"].includes(item.statusPresenca)
  );

  const suffix = context.baseQuery ? `?${context.baseQuery}` : "";

  return [
    {
      key: "semanas",
      label: "Semanas",
      count: weeklyRows.length,
      href: `/agenda/presencas/analise/semanas${suffix}`,
    },
    {
      key: "assistidos",
      label: "Assistidos",
      count: assistidoRows.length,
      href: `/agenda/presencas/analise/assistidos${suffix}`,
    },
    {
      key: "profissionais",
      label: context.canViewAll ? "Profissionais" : "Minha agenda",
      count: profissionalRows.length,
      href: `/agenda/presencas/analise/profissionais${suffix}`,
    },
    {
      key: "ocorrencias",
      label: "Ocorrencias",
      count: occurrenceRows.length,
      href: `/agenda/presencas/analise/ocorrencias${suffix}`,
    },
  ];
}

function buildPresenceDetailView(sectionKey, context, req) {
  const section = parseSelectOption(sectionKey, ["semanas", "assistidos", "profissionais", "ocorrencias"], "semanas");

  if (section === "semanas") {
    const focus = parseSelectOption(req.query?.focoSemanal, ["faltas", "comparecimento", "justificadas", "volume"], "faltas");
    const minEventos = parseNumericChoice(req.query?.minEventosSemanal, [1, 2, 3, 5], 1);
    const somenteSemanasCriticas = parseBooleanFlag(req.query?.somenteSemanasCriticas);

    let rows = buildWeeklyRows(context.filteredEvents).filter((item) => Number(item.total || 0) >= minEventos);
    if (somenteSemanasCriticas) {
      rows = rows.filter((item) => Number(item.totalAusencias || 0) > 0);
    }

    rows.sort((a, b) => {
      if (focus === "comparecimento") {
        if (b.taxaComparecimento !== a.taxaComparecimento) return b.taxaComparecimento - a.taxaComparecimento;
        return b.total - a.total;
      }
      if (focus === "justificadas") {
        if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
        return b.total - a.total;
      }
      if (focus === "volume") {
        if (b.total !== a.total) return b.total - a.total;
        return b.totalAusencias - a.totalAusencias;
      }
      if (b.totalAusencias !== a.totalAusencias) return b.totalAusencias - a.totalAusencias;
      return b.total - a.total;
    });

    const melhorSemana = rows.slice().sort((a, b) => b.taxaComparecimento - a.taxaComparecimento)[0] || null;
    const piorSemana = rows.slice().sort((a, b) => b.totalAusencias - a.totalAusencias)[0] || null;

    return {
      key: section,
      title: "Evolucao semanal da presenca",
      subtitle: "Entenda rapidamente quais semanas concentraram mais faltas, onde o comparecimento foi melhor e quais periodos merecem acompanhamento.",
      backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
      sectionNav: buildDetailSections(context),
      summaryCards: [
        {
          label: "Semanas analisadas",
          value: rows.length,
          meta: "Recortes semanais com agenda no periodo atual.",
          tone: "neutral",
        },
        {
          label: "Melhor comparecimento",
          value: melhorSemana?.label || "Sem dados",
          meta: melhorSemana ? `${melhorSemana.taxaComparecimento}% de presenca` : "Sem agenda suficiente para comparar.",
          tone: "success",
        },
        {
          label: "Semana mais critica",
          value: piorSemana?.label || "Sem dados",
          meta: piorSemana ? `${piorSemana.totalAusencias} ausencia(s) no recorte` : "Nenhuma ausencia registrada.",
          tone: "danger",
        },
        {
          label: "Justificativas no periodo",
          value: context.counters.justificadas || context.counters.faltaJustificada || 0,
          meta: "Ajuda a separar ausencia avisada de falta sem retorno.",
          tone: "warning",
        },
      ],
      filters: {
        focus,
        minEventos,
        somenteSemanasCriticas,
      },
      rows,
    };
  }

  if (section === "assistidos") {
    const ordenar = parseSelectOption(
      req.query?.ordenarAssistidos,
      ["faltas", "justificadas", "taxa_ausencia", "volume", "sequencia"],
      "faltas"
    );
    const minEventos = parseNumericChoice(req.query?.minEventosAssistidos, [1, 2, 3, 5, 8], 1);
    const somenteComAusencia = parseBooleanFlag(req.query?.somenteComAusenciaAssistidos);

    let rows = buildAssistidoRows(context.filteredEvents).filter((item) => Number(item.total || 0) >= minEventos);
    if (somenteComAusencia) {
      rows = rows.filter((item) => Number(item.totalAusencias || 0) > 0);
    }

    rows.sort((a, b) => {
      if (ordenar === "justificadas") {
        if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
        return b.total - a.total;
      }
      if (ordenar === "taxa_ausencia") {
        if (b.taxaAusencia !== a.taxaAusencia) return b.taxaAusencia - a.taxaAusencia;
        return b.total - a.total;
      }
      if (ordenar === "volume") {
        if (b.total !== a.total) return b.total - a.total;
        return b.totalAusencias - a.totalAusencias;
      }
      if (ordenar === "sequencia") {
        if (b.sequenciaAusencias !== a.sequenciaAusencias) return b.sequenciaAusencias - a.sequenciaAusencias;
        return b.totalAusencias - a.totalAusencias;
      }
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });

    const topFaltas = rows[0] || null;
    const topTaxa = rows.slice().sort((a, b) => b.taxaAusencia - a.taxaAusencia)[0] || null;
    const topSequencia = rows.slice().sort((a, b) => b.sequenciaAusencias - a.sequenciaAusencias)[0] || null;

    return {
      key: section,
      title: "Assistidos com mais ausencias",
      subtitle: "Use esta visao para identificar recorrencia, taxa de ausencia e quem esta precisando de contato mais rapido da equipe.",
      backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
      sectionNav: buildDetailSections(context),
      summaryCards: [
        {
          label: "Maior volume de faltas",
          value: topFaltas?.nome || "Sem dados",
          meta: topFaltas ? `${topFaltas.faltas} falta(s) e ${topFaltas.justificadas} justificativa(s)` : "Nenhuma ausencia encontrada.",
          tone: "danger",
        },
        {
          label: "Maior taxa de ausencia",
          value: topTaxa?.nome || "Sem dados",
          meta: topTaxa ? `${topTaxa.taxaAusencia}% de ausencia em ${topTaxa.total} agenda(s)` : "Aguardando historico suficiente.",
          tone: "warning",
        },
        {
          label: "Reincidencia atual",
          value: topSequencia?.nome || "Sem dados",
          meta: topSequencia ? `${topSequencia.sequenciaAusencias} ausencia(s) consecutiva(s)` : "Nenhuma sequencia aberta no periodo.",
          tone: "neutral",
        },
        {
          label: "Assistidos com ausencia",
          value: rows.filter((item) => Number(item.totalAusencias || 0) > 0).length,
          meta: "Recorte util para acao ativa da equipe social ou do responsavel.",
          tone: "info",
        },
      ],
      filters: {
        ordenar,
        minEventos,
        somenteComAusencia,
      },
      rows,
    };
  }

  if (section === "profissionais") {
    const ordenar = parseSelectOption(
      req.query?.ordenarProfissionais,
      ["faltas", "justificadas", "taxa_comparecimento", "volume"],
      "faltas"
    );
    const minEventos = parseNumericChoice(req.query?.minEventosProfissionais, [1, 2, 3, 5, 8], 1);
    const somenteComAusencia = parseBooleanFlag(req.query?.somenteComAusenciaProfissionais);

    let rows = buildProfissionalRows(context.filteredEvents).filter((item) => Number(item.total || 0) >= minEventos);
    if (somenteComAusencia) {
      rows = rows.filter((item) => Number(item.totalAusencias || 0) > 0);
    }

    rows.sort((a, b) => {
      if (ordenar === "justificadas") {
        if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
        return b.total - a.total;
      }
      if (ordenar === "taxa_comparecimento") {
        if (b.taxaComparecimento !== a.taxaComparecimento) return b.taxaComparecimento - a.taxaComparecimento;
        return b.total - a.total;
      }
      if (ordenar === "volume") {
        if (b.total !== a.total) return b.total - a.total;
        return b.totalAusencias - a.totalAusencias;
      }
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });

    const topVolume = rows.slice().sort((a, b) => b.total - a.total)[0] || null;
    const topComparecimento = rows.slice().sort((a, b) => b.taxaComparecimento - a.taxaComparecimento)[0] || null;
    const topAusencias = rows[0] || null;

    return {
      key: section,
      title: context.canViewAll ? "Visao dos profissionais" : "Minha agenda no periodo",
      subtitle: context.canViewAll
        ? "Compare volume, faltas e taxa de comparecimento por responsavel para ajustar distribuicao e acompanhamento."
        : "Veja seu proprio desempenho no periodo e quais assistidos mais concentraram faltas na sua agenda.",
      backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
      sectionNav: buildDetailSections(context),
      summaryCards: [
        {
          label: "Maior volume",
          value: topVolume?.nome || "Sem dados",
          meta: topVolume ? `${topVolume.total} agenda(s) no periodo` : "Nenhum profissional com agenda no recorte.",
          tone: "neutral",
        },
        {
          label: "Melhor comparecimento",
          value: topComparecimento?.nome || "Sem dados",
          meta: topComparecimento ? `${topComparecimento.taxaComparecimento}% de presenca` : "Sem base suficiente no periodo.",
          tone: "success",
        },
        {
          label: "Mais ausencias",
          value: topAusencias?.nome || "Sem dados",
          meta: topAusencias ? `${topAusencias.totalAusencias} ausencia(s) no recorte` : "Nenhuma ausencia registrada.",
          tone: "danger",
        },
        {
          label: "Profissionais analisados",
          value: rows.length,
          meta: context.canViewAll ? "Apenas quem teve agenda dentro do periodo atual." : "Sua agenda consolidada no recorte.",
          tone: "info",
        },
      ],
      filters: {
        ordenar,
        minEventos,
        somenteComAusencia,
      },
      rows,
    };
  }

  const tipoOcorrencia = parseSelectOption(
    req.query?.tipoOcorrencia,
    ["todos", "falta", "falta_justificada", "cancelado_antecipadamente"],
    "todos"
  );
  const somenteComObservacao = parseBooleanFlag(req.query?.somenteComObservacaoOcorrencias);
  const limite = parseNumericChoice(req.query?.limiteOcorrencias, [20, 50, 100], 20);

  let rows = buildOccurrenceRows(context.filteredEvents).filter((item) =>
    ["falta", "falta_justificada", "cancelado_antecipadamente"].includes(item.statusPresenca)
  );

  if (tipoOcorrencia !== "todos") {
    rows = rows.filter((item) => item.statusPresenca === tipoOcorrencia);
  }
  if (somenteComObservacao) {
    rows = rows.filter((item) => item.hasObservacao);
  }
  rows = rows.slice(0, limite);

  return {
    key: "ocorrencias",
    title: "Ocorrencias recentes de ausencia",
    subtitle: "Centralize faltas, justificativas e cancelamentos para encontrar rapidamente o que precisa de retorno, registro ou remarcacao.",
    backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
    sectionNav: buildDetailSections(context),
    summaryCards: [
      {
        label: "Faltas abertas",
        value: context.counters.falta || 0,
        meta: "Ausencias sem justificativa dentro do recorte atual.",
        tone: "danger",
      },
      {
        label: "Justificadas",
        value: context.counters.faltaJustificada || 0,
        meta: "Faltas com contexto registrado na ficha.",
        tone: "warning",
      },
      {
        label: "Canceladas antecipadamente",
        value: context.counters.cancelado || 0,
        meta: "Compromissos cancelados antes do fechamento final.",
        tone: "neutral",
      },
      {
        label: "Ocorrencia mais recente",
        value: rows[0]?.pacienteNome || "Sem dados",
        meta: rows[0] ? `${rows[0].statusPresencaLabel} em ${rows[0].dataHoraLabel}` : "Nenhuma ocorrencia recente.",
        tone: "info",
      },
    ],
    filters: {
      tipoOcorrencia,
      somenteComObservacao,
      limite,
    },
    rows,
  };
}

class AgendaPresencaPageController {
  static async index(req, res) {
    try {
      const [context, attendanceJustifications, quickFilters] = await Promise.all([
        loadPresenceContext(req),
        listPresenceReasons({ includeInactive: false }),
        listQuickFilters("agenda_presencas", { includeInactive: false }),
      ]);

      return res.status(200).render("pages/agenda/presencas", {
        title: "Presencas",
        sectionTitle: "Presencas",
        navKey: "agenda-presencas",
        layout: "partials/app.ejs",
        pageClass: "page-agenda-presencas",
        extraCss: ["/css/agenda.css", "/css/agenda-presencas.css"],
        extraJs: ["/js/agenda-presencas.js"],
        filtros: context.filtros,
        filtrosResumo: buildFilterSummary(context.filtros, context.profissionais),
        calendarControls: buildCalendarControls(context.monthBase),
        profissionais: context.profissionais,
        canViewAll: context.canViewAll,
        statusOptions: buildPresenceStatusOptions(),
        quickFilters,
        attendanceJustifications,
        resumo: {
          ...context.counters,
          taxaComparecimento: context.taxaComparecimento,
        },
        calendario: {
          monthLabel: toMonthLabel(context.monthBase),
          monthSummary: buildPresenceCounters(context.calendarEvents),
          prevMonth: toMonthInputValue(new Date(context.monthBase.getFullYear(), context.monthBase.getMonth() - 1, 1)),
          nextMonth: toMonthInputValue(new Date(context.monthBase.getFullYear(), context.monthBase.getMonth() + 1, 1)),
          days: buildCalendarDays(context.calendarEvents, context.monthBase, context.filtros.dia),
          selectedDayLabel: toLongDateLabel(context.selectedDay),
          selectedDaySummary: buildPresenceCounters(context.selectedDayEventsRaw),
          selectedDayEvents: mapDayEvents(context.selectedDayEventsRaw),
        },
        serieSemanal: buildSeries(context.filteredEvents),
        rankingAssistidos: buildAssistidoRanking(context.filteredEvents),
        rankingProfissionais: buildProfissionalRanking(context.filteredEvents),
        ultimasOcorrencias: buildUltimasOcorrencias(context.filteredEvents),
      });
    } catch (error) {
      console.error("Erro ao carregar painel de presencas:", error);
      const status = Number(error?.status || 500);
      return res.status(status).render(`pages/errors/${status === 403 ? "403" : status === 400 ? "400" : "500"}`, {
        status,
        message: error?.publicMessage || "Erro ao carregar o painel de presencas.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async detail(req, res) {
    try {
      const [context, attendanceJustifications] = await Promise.all([
        loadPresenceContext(req),
        listPresenceReasons({ includeInactive: false }),
      ]);
      const detail = buildPresenceDetailView(req.params?.section, context, req);

      return res.status(200).render("pages/agenda/presencas-detalhe", {
        title: "Analise de presencas",
        sectionTitle: "Presencas",
        navKey: "agenda-presencas",
        layout: "partials/app.ejs",
        pageClass: "page-agenda-presencas-detail",
        extraCss: ["/css/agenda.css", "/css/agenda-presencas.css"],
        extraJs: ["/js/agenda-presencas.js"],
        filtros: context.filtros,
        filtrosResumo: buildFilterSummary(context.filtros, context.profissionais),
        profissionais: context.profissionais,
        canViewAll: context.canViewAll,
        attendanceJustifications,
        resumo: {
          ...context.counters,
          taxaComparecimento: context.taxaComparecimento,
        },
        detail,
      });
    } catch (error) {
      console.error("Erro ao carregar detalhe de presencas:", error);
      const status = Number(error?.status || 500);
      return res.status(status).render(`pages/errors/${status === 403 ? "403" : status === 400 ? "400" : "500"}`, {
        status,
        message: error?.publicMessage || "Erro ao carregar a analise de presencas.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }
}

module.exports = AgendaPresencaPageController;
