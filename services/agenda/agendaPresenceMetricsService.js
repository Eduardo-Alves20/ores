const { toDateTimeLabel } = require("../shared/dateFormattingService");

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

module.exports = {
  PRESENCA_LABELS,
  parseDateInput,
  parseMonthInput,
  toDateInputValue,
  toMonthInputValue,
  toDateTimeLabel,
  toTimeLabel,
  toLongDateLabel,
  toMonthLabel,
  getMonthRange,
  sameMonth,
  parsePresenceStatusFilter,
  buildPresenceCounters,
  matchesPresenceFilters,
  buildSeries,
  buildAssistidoRanking,
  buildProfissionalRanking,
  buildUltimasOcorrencias,
  buildCalendarDays,
  mapDayEvents,
  buildPresenceStatusOptions,
  buildFilterSummary,
  buildCalendarControls,
  parseSelectOption,
  parseNumericChoice,
  parseBooleanFlag,
  buildWeeklyRows,
  buildAssistidoRows,
  buildProfissionalRows,
  buildOccurrenceRows,
  buildBasePresenceQuery,
};
