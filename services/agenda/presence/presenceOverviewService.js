const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { PRESENCA_LABELS } = require("./presenceConstants");
const {
  getMonthRange,
  getWeekStart,
  toDateInputValue,
  toTimeLabel,
  toWeekLabel,
} = require("./presenceDateService");
const { buildPresenceCounters } = require("./presenceMetricHelpers");

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

module.exports = {
  buildSeries,
  buildAssistidoRanking,
  buildProfissionalRanking,
  buildUltimasOcorrencias,
  buildCalendarDays,
  mapDayEvents,
  buildCalendarControls,
};
