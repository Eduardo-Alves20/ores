const mongoose = require("mongoose");

const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { Atendimento } = require("../../schemas/social/Atendimento");
const Usuario = require("../../schemas/core/Usuario");
const { Paciente } = require("../../schemas/social/Paciente");
const Familia = require("../../schemas/social/Familia");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../accessControlService");
const { buildProfessionalAnalysisHref } = require("./consultationProfessionalDetailPageService");
const { buildWeekdayAnalysisHref } = require("./consultationWeekdayDetailPageService");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EMPTY_DONUT_GRADIENT = "conic-gradient(#e8dad1 0 100%)";

const STATUS_META = Object.freeze({
  presentes: { label: "Presen\u00e7as", color: "#16a34a" },
  faltas: { label: "Faltas", color: "#ef4444" },
  justificadas: { label: "Faltas justificadas", color: "#f59e0b" },
  pendentes: { label: "Pendentes", color: "#3b82f6" },
  canceladas: { label: "Canceladas", color: "#94a3b8" },
});

const TIPO_META = Object.freeze({
  visita_domiciliar: "Visita domiciliar",
  atendimento_sede: "Atendimento na sede",
  entrega_beneficio: "Entrega de benef\u00edcio",
  reuniao_equipe: "Reuni\u00e3o de equipe",
  outro: "Outro",
});

const WEEKDAY_META = Object.freeze([
  { key: 0, label: "Domingo", shortLabel: "Dom" },
  { key: 1, label: "Segunda-feira", shortLabel: "Seg" },
  { key: 2, label: "Ter\u00e7a-feira", shortLabel: "Ter" },
  { key: 3, label: "Quarta-feira", shortLabel: "Qua" },
  { key: 4, label: "Quinta-feira", shortLabel: "Qui" },
  { key: 5, label: "Sexta-feira", shortLabel: "Sex" },
  { key: 6, label: "S\u00e1bado", shortLabel: "S\u00e1b" },
]);

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

function pad(value) {
  return String(value || "").padStart(2, "0");
}

function toObjectId(value) {
  const raw = String(value || "").trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function toIdString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function startOfDay(dateLike) {
  const date = new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(dateLike) {
  const date = new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(dateLike, amount) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + Number(amount || 0));
  return date;
}

function addMonths(dateLike, amount) {
  const date = new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth() + Number(amount || 0), 1, 12, 0, 0, 0);
}

function toLocalDateKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toMonthKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function toShortDateLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return SHORT_DATE_FORMATTER.format(date);
}

function toMonthLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  const raw = MONTH_LABEL_FORMATTER.format(date).replace(".", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function toLocaleNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function toPercent(part, total) {
  if (!Number(total)) return 0;
  return Math.round((Number(part || 0) / Number(total || 1)) * 100);
}

function toInitials(value, fallback = "AL") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function parseDateInput(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRangeLabel(start, end, preset) {
  if (preset === "7d") return "\u00daltimos 7 dias";
  if (preset === "30d") return "\u00daltimos 30 dias";
  if (preset === "90d") return "\u00daltimos 90 dias";
  if (preset === "12m") return "\u00daltimos 12 meses";
  return `${toShortDateLabel(start)} at\u00e9 ${toShortDateLabel(end)}`;
}

function diffDaysInclusive(start, end) {
  const startDate = startOfDay(start);
  const endDate = startOfDay(end);
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1);
}

function buildPeriodModel(query = {}, now = new Date()) {
  const requestedPreset = String(query?.periodo || "30d").trim().toLowerCase();
  const preset = ["7d", "30d", "90d", "12m", "custom"].includes(requestedPreset)
    ? requestedPreset
    : "30d";

  let start = startOfDay(addDays(now, -29));
  let end = endOfDay(now);
  let effectivePreset = preset;

  if (preset === "7d") {
    start = startOfDay(addDays(now, -6));
  } else if (preset === "90d") {
    start = startOfDay(addDays(now, -89));
  } else if (preset === "12m") {
    start = startOfDay(addMonths(now, -11));
  } else if (preset === "custom") {
    const customStart = parseDateInput(query?.dataInicio);
    const customEnd = parseDateInput(query?.dataFim);

    if (customStart && customEnd && customStart <= customEnd) {
      start = startOfDay(customStart);
      end = endOfDay(customEnd);
    } else {
      effectivePreset = "30d";
    }
  }

  const daysInclusive = diffDaysInclusive(start, end);
  const previousEnd = endOfDay(addDays(start, -1));
  const previousStart = startOfDay(addDays(previousEnd, -(daysInclusive - 1)));

  return {
    preset: effectivePreset,
    start,
    end,
    daysInclusive,
    label: formatRangeLabel(start, end, effectivePreset),
    startInput: toLocalDateKey(start),
    endInput: toLocalDateKey(end),
    previousStart,
    previousEnd,
    options: [
      { value: "7d", label: "\u00daltimos 7 dias" },
      { value: "30d", label: "\u00daltimos 30 dias" },
      { value: "90d", label: "\u00daltimos 90 dias" },
      { value: "12m", label: "\u00daltimos 12 meses" },
      { value: "custom", label: "Per\u00edodo customizado" },
    ],
  };
}

function buildTrend(current, previous, options = {}) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  const positiveWhen = options.positiveWhen || "up";
  const suffix = options.suffix || "vs. per\u00edodo anterior";

  if (previousValue === 0) {
    if (currentValue === 0) {
      return { direction: "flat", tone: "neutral", label: "Sem varia\u00e7\u00e3o relevante." };
    }

    return {
      direction: "up",
      tone: positiveWhen === "up" ? "positive" : "negative",
      label: `Novo volume ${suffix}`,
    };
  }

  const delta = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Number(delta.toFixed(1));
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const tone =
    direction === "flat"
      ? "neutral"
      : direction === positiveWhen
        ? "positive"
        : "negative";

  return {
    direction,
    tone,
    label: `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}% ${suffix}`,
  };
}

function buildCard(options) {
  return {
    key: options.key,
    icon: options.icon,
    title: options.title,
    value: options.value,
    caption: options.caption || "",
    trend: options.trend || null,
    progress: options.progress || null,
    href: options.href || "",
  };
}

function buildTimelineBuckets(period) {
  const useMonthly = period.preset === "12m" || period.daysInclusive > 180;
  const useWeekly = !useMonthly && period.daysInclusive > 45;
  const granularity = useMonthly ? "month" : useWeekly ? "week" : "day";
  const buckets = [];

  if (granularity === "month") {
    let cursor = new Date(period.start.getFullYear(), period.start.getMonth(), 1, 12, 0, 0, 0);
    const limit = new Date(period.end.getFullYear(), period.end.getMonth(), 1, 12, 0, 0, 0);

    while (cursor <= limit) {
      buckets.push({
        key: toMonthKey(cursor),
        label: toMonthLabel(cursor),
        total: 0,
        presentes: 0,
        faltas: 0,
        relatorios: 0,
      });
      cursor = addMonths(cursor, 1);
    }
  } else if (granularity === "week") {
    let cursor = startOfDay(period.start);

    while (cursor <= period.end) {
      const bucketStart = startOfDay(cursor);
      const bucketEnd = endOfDay(addDays(bucketStart, 6));
      const clampedEnd = bucketEnd > period.end ? period.end : bucketEnd;

      buckets.push({
        key: toLocalDateKey(bucketStart),
        label: `${toShortDateLabel(bucketStart)} a ${toShortDateLabel(clampedEnd)}`,
        total: 0,
        presentes: 0,
        faltas: 0,
        relatorios: 0,
      });

      cursor = addDays(bucketStart, 7);
    }
  } else {
    let cursor = startOfDay(period.start);

    while (cursor <= period.end) {
      buckets.push({
        key: toLocalDateKey(cursor),
        label: toShortDateLabel(cursor),
        total: 0,
        presentes: 0,
        faltas: 0,
        relatorios: 0,
      });
      cursor = addDays(cursor, 1);
    }
  }

  return {
    granularity,
    start: period.start,
    end: period.end,
    buckets,
    map: new Map(buckets.map((bucket) => [bucket.key, bucket])),
  };
}

function resolveBucketKey(dateLike, timelineModel) {
  if (!dateLike || !timelineModel) return "";
  if (timelineModel.granularity === "month") return toMonthKey(dateLike);
  if (timelineModel.granularity === "day") return toLocalDateKey(dateLike);

  const diffDays = Math.max(
    0,
    Math.floor((startOfDay(dateLike).getTime() - startOfDay(timelineModel.start).getTime()) / MS_PER_DAY)
  );
  const offset = Math.floor(diffDays / 7) * 7;
  return toLocalDateKey(addDays(timelineModel.start, offset));
}

function classifyConsultation(evento) {
  if (!evento) return "pendentes";
  if (
    String(evento.statusAgendamento || "") === "cancelado" ||
    String(evento.statusPresenca || "") === "cancelado_antecipadamente"
  ) {
    return "canceladas";
  }

  if (String(evento.statusPresenca || "") === "presente") return "presentes";
  if (String(evento.statusPresenca || "") === "falta") return "faltas";
  if (String(evento.statusPresenca || "") === "falta_justificada") return "justificadas";
  return "pendentes";
}

function createCounter() {
  return {
    total: 0,
    presentes: 0,
    faltas: 0,
    justificadas: 0,
    pendentes: 0,
    canceladas: 0,
    emAjuste: 0,
    relatorios: 0,
  };
}

function applyConsultationToCounter(counter, evento) {
  if (!counter || !evento) return;
  counter.total += 1;
  counter[classifyConsultation(evento)] += 1;
  if (String(evento.statusAgendamento || "") === "em_negociacao_remarcacao") {
    counter.emAjuste += 1;
  }
}

function finalizeCounter(counter) {
  const validTotal = Math.max(0, Number(counter.total || 0) - Number(counter.canceladas || 0));
  const faltasTotal = Number(counter.faltas || 0) + Number(counter.justificadas || 0);
  const comparecimento = toPercent(counter.presentes, validTotal);
  const coberturaRelatorios = toPercent(counter.relatorios, Number(counter.total || 0));

  return {
    ...counter,
    validTotal,
    faltasTotal,
    comparecimento,
    coberturaRelatorios,
  };
}

function buildDonutModel(counter) {
  const finalCounter = finalizeCounter(counter || createCounter());
  const items = Object.entries(STATUS_META).map(([key, meta]) => {
    const value = Number(finalCounter[key] || 0);
    return {
      key,
      label: meta.label,
      color: meta.color,
      value,
      share: toPercent(value, finalCounter.total),
      valueLabel: toLocaleNumber(value),
    };
  });

  if (!finalCounter.total) {
    return {
      total: 0,
      totalLabel: "0",
      gradient: EMPTY_DONUT_GRADIENT,
      items,
    };
  }

  let accumulated = 0;
  const stops = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = accumulated;
      accumulated += (item.value / finalCounter.total) * 100;
      return `${item.color} ${start.toFixed(2)}% ${Math.min(accumulated, 100).toFixed(2)}%`;
    });

  return {
    total: finalCounter.total,
    totalLabel: toLocaleNumber(finalCounter.total),
    gradient: stops.length ? `conic-gradient(${stops.join(", ")})` : EMPTY_DONUT_GRADIENT,
    items,
  };
}

function getSessionUser(req) {
  return req?.currentUser || req?.session?.user || null;
}

function getActorId(req) {
  const user = getSessionUser(req);
  return String(user?.id || user?._id || "").trim();
}

function getPermissionList(req) {
  const user = getSessionUser(req);
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

function normalizeProfessionalDoc(usuario) {
  if (!usuario) return null;
  return {
    _id: toIdString(usuario._id),
    nome: String(usuario.nome || "Profissional").trim() || "Profissional",
    perfil: String(usuario.perfil || "").trim(),
    email: String(usuario.email || "").trim(),
  };
}

function resolveReportProfessionalId(relatorio) {
  return toIdString(relatorio?.profissionalId || relatorio?.criadoPor);
}

function buildEmptyViewModel(req, message) {
  const period = buildPeriodModel(req?.query || {});

  return {
    title: "Relat\u00f3rios",
    sectionTitle: "Dashboard de Consultas",
    navKey: "relatorios-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard page-consulta-dashboard",
    extraCss: ["/css/dashboard.css", "/css/consultation-dashboard.css"],
    extraJs: ["/js/consultation-dashboard.js"],
    header: {
      title: "Consultas da opera\u00e7\u00e3o",
      subtitle: message || "N\u00e3o foi poss\u00edvel montar o painel anal\u00edtico agora.",
      stats: [
        { label: "Per\u00edodo", value: period.label },
        { label: "Profissional", value: "Toda a equipe" },
        { label: "Fam\u00edlias alcan\u00e7adas", value: "0" },
      ],
      chips: [],
    },
    filters: {
      action: "/relatorios/consultas",
      periodo: period.preset,
      dataInicio: period.startInput,
      dataFim: period.endInput,
      professionalId: "",
      professionalOptions: [],
      canViewAll: true,
    },
    summaryCards: [
      buildCard({
        key: "consultas",
        icon: "fa-solid fa-calendar-days",
        title: "Consultas no per\u00edodo",
        value: "0",
        caption: "Sem indicadores dispon\u00edveis.",
      }),
    ],
    timelinePanel: {
      title: "Tend\u00eancia de consultas",
      subtitle: "Sem dados para exibir no momento.",
      kpis: [],
      legend: [],
    },
    statusDistribution: buildDonutModel(createCounter()),
    rankingPanel: {
      overline: "Produtividade",
      title: "Sem dados dispon\u00edveis",
      subtitle: "Assim que houver consultas registradas o comparativo aparece aqui.",
      items: [],
      emptyMessage: "Nenhuma consulta encontrada para este recorte.",
    },
    weekdayRows: [],
    typeRows: [],
    highlights: [],
    detailTable: {
      overline: "Detalhamento",
      title: "Comparativo do per\u00edodo",
      subtitle: "Os dados detalhados aparecer\u00e3o aqui assim que houver movimenta\u00e7\u00e3o.",
      modeLabel: "Equipe",
      rows: [],
      emptyMessage: "Nenhuma consulta encontrada para este recorte.",
    },
    emptyStates: {
      distribution: "Nenhuma consulta encontrada no per\u00edodo.",
      timeline: "Nenhuma consulta encontrada no per\u00edodo.",
      ranking: "Nenhum comparativo dispon\u00edvel.",
      weekday: "Sem distribui\u00e7\u00e3o por dia da semana.",
      type: "Sem tipos de atendimento registrados.",
      table: "Nenhuma linha dispon\u00edvel para comparar.",
    },
    consultationDashboardData: {
      timeline: {
        series: [],
        meta: {},
      },
    },
  };
}

function ensureDimension(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key);
}

async function buildConsultationAnalyticsViewModel(req) {
  const user = getSessionUser(req);
  const permissions = getPermissionList(req);
  const actorId = getActorId(req);
  const canViewAllAgenda = hasAnyPermission(permissions, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const period = buildPeriodModel(req?.query || {});
  const requestedProfessionalId = toIdString(req?.query?.responsavelId || "");
  const scopedProfessionalId = canViewAllAgenda ? requestedProfessionalId : actorId;
  const selectedProfessionalObjectId = toObjectId(scopedProfessionalId);

  const currentEventMatch = {
    ativo: true,
    inicio: {
      $gte: period.start,
      $lte: period.end,
    },
  };

  const previousEventMatch = {
    ativo: true,
    inicio: {
      $gte: period.previousStart,
      $lte: period.previousEnd,
    },
  };

  const currentReportMatch = {
    ativo: true,
    dataHora: {
      $gte: period.start,
      $lte: period.end,
    },
  };

  const previousReportMatch = {
    ativo: true,
    dataHora: {
      $gte: period.previousStart,
      $lte: period.previousEnd,
    },
  };

  if (selectedProfessionalObjectId) {
    currentEventMatch.responsavelId = selectedProfessionalObjectId;
    previousEventMatch.responsavelId = selectedProfessionalObjectId;
    currentReportMatch.$or = [
      { profissionalId: selectedProfessionalObjectId },
      { criadoPor: selectedProfessionalObjectId },
    ];
    previousReportMatch.$or = [
      { profissionalId: selectedProfessionalObjectId },
      { criadoPor: selectedProfessionalObjectId },
    ];
  }

  const professionalBaseFilter = {
    ativo: true,
    tipoCadastro: { $ne: "familia" },
  };

  const professionalQuery = canViewAllAgenda
    ? Usuario.find(professionalBaseFilter, "_id nome perfil email").sort({ nome: 1 }).lean()
    : actorId
      ? Usuario.find({ _id: toObjectId(actorId) }, "_id nome perfil email").lean()
      : Promise.resolve([]);

  const [
    professionalDocs,
    selectedProfessionalDoc,
    currentEvents,
    previousEvents,
    currentReports,
    previousReports,
  ] = await Promise.all([
    professionalQuery,
    selectedProfessionalObjectId
      ? Usuario.findById(selectedProfessionalObjectId, "_id nome perfil email").lean()
      : Promise.resolve(null),
    AgendaEvento.find(
      currentEventMatch,
      "_id titulo inicio statusAgendamento statusPresenca tipoAtendimento familiaId pacienteId responsavelId"
    ).lean(),
    AgendaEvento.find(
      previousEventMatch,
      "_id inicio statusAgendamento statusPresenca responsavelId"
    ).lean(),
    Atendimento.find(
      currentReportMatch,
      "_id dataHora familiaId pacienteId profissionalId criadoPor"
    ).lean(),
    Atendimento.find(
      previousReportMatch,
      "_id dataHora profissionalId criadoPor"
    ).lean(),
  ]);

  const professionalMap = new Map();
  const professionalOptions = [];

  professionalDocs
    .map(normalizeProfessionalDoc)
    .filter(Boolean)
    .forEach((item) => {
      professionalMap.set(item._id, item);
      professionalOptions.push({
        value: item._id,
        label: item.nome,
      });
    });

  const selectedProfessionalNormalized = normalizeProfessionalDoc(selectedProfessionalDoc);
  if (selectedProfessionalNormalized && !professionalMap.has(selectedProfessionalNormalized._id)) {
    professionalMap.set(selectedProfessionalNormalized._id, selectedProfessionalNormalized);
    professionalOptions.push({
      value: selectedProfessionalNormalized._id,
      label: selectedProfessionalNormalized.nome,
    });
  }

  const currentProfessionalName = selectedProfessionalNormalized?.nome
    || professionalMap.get(scopedProfessionalId)?.nome
    || user?.nome
    || "Profissional";

  const patientIds = new Set();
  const familyIds = new Set();
  const referencedProfessionalIds = new Set();

  currentEvents.forEach((evento) => {
    const patientId = toIdString(evento?.pacienteId);
    const familyId = toIdString(evento?.familiaId);
    const professionalId = toIdString(evento?.responsavelId);
    if (patientId) patientIds.add(patientId);
    if (familyId) familyIds.add(familyId);
    if (professionalId) referencedProfessionalIds.add(professionalId);
  });

  currentReports.forEach((relatorio) => {
    const patientId = toIdString(relatorio?.pacienteId);
    const familyId = toIdString(relatorio?.familiaId);
    const professionalId = resolveReportProfessionalId(relatorio);
    if (patientId) patientIds.add(patientId);
    if (familyId) familyIds.add(familyId);
    if (professionalId) referencedProfessionalIds.add(professionalId);
  });

  if (scopedProfessionalId) referencedProfessionalIds.add(scopedProfessionalId);

  const [patientDocs, familyDocs, referencedProfessionalDocs] = await Promise.all([
    patientIds.size
      ? Paciente.find({ _id: { $in: Array.from(patientIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id nome matricula familiaId").lean()
      : Promise.resolve([]),
    familyIds.size
      ? Familia.find({ _id: { $in: Array.from(familyIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id responsavel").lean()
      : Promise.resolve([]),
    referencedProfessionalIds.size
      ? Usuario.find({ _id: { $in: Array.from(referencedProfessionalIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id nome perfil email").lean()
      : Promise.resolve([]),
  ]);

  const patientMap = new Map(
    patientDocs.map((doc) => [
      toIdString(doc._id),
      {
        _id: toIdString(doc._id),
        nome: String(doc.nome || "Assistido").trim() || "Assistido",
        matricula: String(doc.matricula || "").trim(),
        familiaId: toIdString(doc.familiaId),
      },
    ])
  );

  const familyMap = new Map(
    familyDocs.map((doc) => [
      toIdString(doc._id),
      {
        _id: toIdString(doc._id),
        nome: String(doc?.responsavel?.nome || "Fam\u00edlia").trim() || "Fam\u00edlia",
      },
    ])
  );

  referencedProfessionalDocs
    .map(normalizeProfessionalDoc)
    .filter(Boolean)
    .forEach((item) => {
      professionalMap.set(item._id, item);
    });

  const currentCounter = createCounter();
  const previousCounter = createCounter();
  const timelineModel = buildTimelineBuckets(period);
  const weekdayMap = new Map(WEEKDAY_META.map((item) => [item.key, { ...item, ...createCounter() }]));
  const typeMap = new Map(
    Object.entries(TIPO_META).map(([key, label]) => [
      key,
      { key, label, ...createCounter() },
    ])
  );
  const rankingMap = new Map();
  const globalFamilies = new Set();
  const globalPatients = new Set();

  currentEvents.forEach((evento) => {
    applyConsultationToCounter(currentCounter, evento);

    const classification = classifyConsultation(evento);
    const bucket = timelineModel.map.get(resolveBucketKey(evento.inicio, timelineModel));
    if (bucket) {
      bucket.total += 1;
      if (classification === "presentes") bucket.presentes += 1;
      if (classification === "faltas" || classification === "justificadas") bucket.faltas += 1;
    }

    const weekday = weekdayMap.get(new Date(evento.inicio).getDay());
    if (weekday) applyConsultationToCounter(weekday, evento);

    const typeEntry = typeMap.get(String(evento.tipoAtendimento || "outro")) || typeMap.get("outro");
    if (typeEntry) applyConsultationToCounter(typeEntry, evento);

    const familyId = toIdString(evento?.familiaId);
    const patientId = toIdString(evento?.pacienteId);
    const professionalId = toIdString(evento?.responsavelId);
    if (familyId) globalFamilies.add(familyId);
    if (patientId) globalPatients.add(patientId);

    const rankingKey = selectedProfessionalObjectId
      ? patientId
        ? `paciente:${patientId}`
        : familyId
          ? `familia:${familyId}`
          : `evento:${toIdString(evento._id)}`
      : professionalId || "sem-responsavel";

    const rankingEntry = ensureDimension(rankingMap, rankingKey, () => {
      if (selectedProfessionalObjectId) {
        const patient = patientMap.get(patientId);
        const family = familyMap.get(familyId || patient?.familiaId);
        const label = patient?.nome || family?.nome || "Fam\u00edlia sem v\u00ednculo";
        const subtitle = patient
          ? [
              patient.matricula ? patient.matricula : "",
              family?.nome ? `Fam\u00edlia ${family.nome}` : "",
            ]
              .filter(Boolean)
              .join(" \u2022 ")
          : "Consulta vinculada \u00e0 fam\u00edlia";

        return {
          key: rankingKey,
          label,
          subtitle,
          initials: toInitials(label, "FA"),
          href: family?._id ? `/familias/${family._id}` : `/agenda?responsavelId=${encodeURIComponent(scopedProfessionalId)}`,
          families: new Set(),
          patients: new Set(),
          counter: createCounter(),
        };
      }

      const professional = professionalMap.get(professionalId);
      const label = professional?.nome || "Profissional n\u00e3o identificado";
      return {
        key: rankingKey,
        label,
        subtitle: professional?.perfil || "Respons\u00e1vel da agenda",
        initials: toInitials(label, "PR"),
        href: professionalId ? `/agenda?responsavelId=${encodeURIComponent(professionalId)}` : "/agenda",
        detailHref: professionalId ? buildProfessionalAnalysisHref(professionalId, req?.query || {}) : "",
        families: new Set(),
        patients: new Set(),
        counter: createCounter(),
      };
    });

    applyConsultationToCounter(rankingEntry.counter, evento);
    if (familyId) rankingEntry.families.add(familyId);
    if (patientId) rankingEntry.patients.add(patientId);
  });

  previousEvents.forEach((evento) => {
    applyConsultationToCounter(previousCounter, evento);
  });

  currentReports.forEach((relatorio) => {
    currentCounter.relatorios += 1;

    const bucket = timelineModel.map.get(resolveBucketKey(relatorio.dataHora, timelineModel));
    if (bucket) bucket.relatorios += 1;

    const familyId = toIdString(relatorio?.familiaId);
    const patientId = toIdString(relatorio?.pacienteId);
    if (familyId) globalFamilies.add(familyId);
    if (patientId) globalPatients.add(patientId);

    const rankingKey = selectedProfessionalObjectId
      ? patientId
        ? `paciente:${patientId}`
        : familyId
          ? `familia:${familyId}`
          : `relatorio:${toIdString(relatorio._id)}`
      : resolveReportProfessionalId(relatorio) || "sem-responsavel";

    const rankingEntry = ensureDimension(rankingMap, rankingKey, () => {
      if (selectedProfessionalObjectId) {
        const patient = patientMap.get(patientId);
        const family = familyMap.get(familyId || patient?.familiaId);
        const label = patient?.nome || family?.nome || "Fam\u00edlia sem v\u00ednculo";
        return {
          key: rankingKey,
          label,
          subtitle: patient
            ? [
                patient.matricula ? patient.matricula : "",
                family?.nome ? `Fam\u00edlia ${family.nome}` : "",
              ]
                .filter(Boolean)
                .join(" \u2022 ")
            : "Somente relat\u00f3rio registrado",
          initials: toInitials(label, "FA"),
          href: family?._id ? `/familias/${family._id}` : `/agenda?responsavelId=${encodeURIComponent(scopedProfessionalId)}`,
          families: new Set(),
          patients: new Set(),
          counter: createCounter(),
        };
      }

      const professionalId = resolveReportProfessionalId(relatorio);
      const professional = professionalMap.get(professionalId);
      const label = professional?.nome || "Profissional n\u00e3o identificado";
      return {
        key: rankingKey,
        label,
        subtitle: professional?.perfil || "Respons\u00e1vel da agenda",
        initials: toInitials(label, "PR"),
        href: professionalId ? `/agenda?responsavelId=${encodeURIComponent(professionalId)}` : "/agenda",
        detailHref: professionalId ? buildProfessionalAnalysisHref(professionalId, req?.query || {}) : "",
        families: new Set(),
        patients: new Set(),
        counter: createCounter(),
      };
    });

    rankingEntry.counter.relatorios += 1;
    if (familyId) rankingEntry.families.add(familyId);
    if (patientId) rankingEntry.patients.add(patientId);
  });

  previousReports.forEach(() => {
    previousCounter.relatorios += 1;
  });

  const finalCurrentCounter = finalizeCounter(currentCounter);
  const finalPreviousCounter = finalizeCounter(previousCounter);
  const statusDistribution = buildDonutModel(finalCurrentCounter);

  const rankingRows = Array.from(rankingMap.values())
    .map((entry) => {
      const finalCounter = finalizeCounter(entry.counter);
      const familyCount = entry.families.size;
      const patientCount = entry.patients.size;
      return {
        key: entry.key,
        label: entry.label,
        subtitle: entry.subtitle,
        initials: entry.initials,
        href: entry.href,
        detailHref: entry.detailHref || "",
        familyCount,
        patientCount,
        total: finalCounter.total,
        totalLabel: toLocaleNumber(finalCounter.total),
        presentes: finalCounter.presentes,
        presentesLabel: toLocaleNumber(finalCounter.presentes),
        faltasLabel: `${toLocaleNumber(finalCounter.faltas)} / ${toLocaleNumber(finalCounter.justificadas)}`,
        faltasTotal: finalCounter.faltasTotal,
        faltasTotalLabel: toLocaleNumber(finalCounter.faltasTotal),
        ajusteLabel: toLocaleNumber(finalCounter.emAjuste),
        relatoriosLabel: toLocaleNumber(finalCounter.relatorios),
        comparecimento: finalCounter.comparecimento,
        comparecimentoLabel: `${finalCounter.comparecimento}%`,
        absenceRate: toPercent(finalCounter.faltasTotal, finalCounter.validTotal),
        counter: finalCounter,
      };
    })
    .sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      if (right.presentes !== left.presentes) return right.presentes - left.presentes;
      return right.counter.relatorios - left.counter.relatorios;
    });

  const rankingTopTotal = rankingRows[0]?.total || 0;
  const rankingTop = rankingRows.slice(0, 6).map((row) => ({
    ...row,
    value: row.total,
    share: rankingTopTotal ? Math.max(8, Math.round((row.total / rankingTopTotal) * 100)) : 0,
    hint: selectedProfessionalObjectId
      ? `${row.comparecimentoLabel} de comparecimento \u2022 ${row.relatoriosLabel} relat\u00f3rio(s)`
      : `${toLocaleNumber(row.familyCount)} fam\u00edlia(s) \u2022 ${toLocaleNumber(row.patientCount)} assistido(s)`,
  }));

  const weekdayRows = WEEKDAY_META.map((item) => {
    const counter = finalizeCounter(weekdayMap.get(item.key));
    return {
      key: item.key,
      label: item.label,
      shortLabel: item.shortLabel,
      total: counter.total,
      totalLabel: toLocaleNumber(counter.total),
      presentesLabel: toLocaleNumber(counter.presentes),
      faltasLabel: toLocaleNumber(counter.faltasTotal),
      ajusteLabel: toLocaleNumber(counter.emAjuste),
      comparecimentoLabel: `${counter.comparecimento}%`,
      href: buildWeekdayAnalysisHref(
        {
          mes: period.end.getMonth() + 1,
          ano: period.end.getFullYear(),
          responsavelId: scopedProfessionalId || "",
        },
        { diaSemana: item.key }
      ),
    };
  });

  const typeRows = Array.from(typeMap.values())
    .map((entry) => {
      const counter = finalizeCounter(entry);
      return {
        key: entry.key,
        label: entry.label,
        initials: toInitials(entry.label, "TP"),
        total: counter.total,
        totalLabel: toLocaleNumber(counter.total),
        comparecimentoLabel: `${counter.comparecimento}%`,
        relatoriosLabel: toLocaleNumber(counter.relatorios),
        counter,
      };
    })
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total);

  const typeTopTotal = typeRows[0]?.total || 0;
  typeRows.forEach((item) => {
    item.share = typeTopTotal ? Math.max(10, Math.round((item.total / typeTopTotal) * 100)) : 0;
    item.hint = `${item.comparecimentoLabel} de comparecimento`;
  });

  const highestAbsenceRow = rankingRows
    .filter((item) => item.counter.validTotal > 0)
    .sort((left, right) => right.absenceRate - left.absenceRate)[0];
  const busiestWeekday = weekdayRows.slice().sort((left, right) => right.total - left.total)[0];
  const reportCoverage = finalCurrentCounter.coberturaRelatorios;

  const header = {
    title: selectedProfessionalObjectId
      ? `Consultas de ${currentProfessionalName}`
      : "Consultas da opera\u00e7\u00e3o",
    subtitle: selectedProfessionalObjectId
      ? "Acompanhe volume, comparecimento, faltas e cobertura de relat\u00f3rios do profissional selecionado."
      : "Leia a agenda da equipe com filtros por profissional, comportamento de faltas e distribui\u00e7\u00e3o de atendimentos.",
    stats: [
      { label: "Per\u00edodo", value: period.label },
      {
        label: "Profissional",
        value: selectedProfessionalObjectId ? currentProfessionalName : "Toda a equipe",
      },
      {
        label: selectedProfessionalObjectId ? "Assistidos alcan\u00e7ados" : "Fam\u00edlias alcan\u00e7adas",
        value: selectedProfessionalObjectId
          ? toLocaleNumber(globalPatients.size || globalFamilies.size)
          : toLocaleNumber(globalFamilies.size),
      },
    ],
    chips: [
      {
        label: "Consultas",
        value: toLocaleNumber(finalCurrentCounter.total),
      },
      {
        label: "Relat\u00f3rios",
        value: toLocaleNumber(finalCurrentCounter.relatorios),
      },
      {
        label: selectedProfessionalObjectId ? "Fam\u00edlias" : "Profissionais ativos",
        value: selectedProfessionalObjectId
          ? toLocaleNumber(globalFamilies.size)
          : toLocaleNumber(
              new Set(currentEvents.map((evento) => toIdString(evento.responsavelId)).filter(Boolean)).size
            ),
      },
      {
        label: "Comparecimento",
        value: `${finalCurrentCounter.comparecimento}%`,
      },
    ],
  };

  const agendaHref = selectedProfessionalObjectId
    ? `/agenda?responsavelId=${encodeURIComponent(scopedProfessionalId)}`
    : "/agenda";

  const summaryCards = [
    buildCard({
      key: "consultas",
      icon: "fa-solid fa-calendar-days",
      title: "Consultas no per\u00edodo",
      value: toLocaleNumber(finalCurrentCounter.total),
      caption: "Total de compromissos analisados na agenda.",
      trend: buildTrend(finalCurrentCounter.total, finalPreviousCounter.total, {
        positiveWhen: "up",
      }),
      href: agendaHref,
    }),
    buildCard({
      key: "presencas",
      icon: "fa-solid fa-user-check",
      title: "Presen\u00e7as confirmadas",
      value: toLocaleNumber(finalCurrentCounter.presentes),
      caption: "Consultas efetivamente realizadas no recorte.",
      trend: buildTrend(finalCurrentCounter.presentes, finalPreviousCounter.presentes, {
        positiveWhen: "up",
      }),
      href: agendaHref,
    }),
    buildCard({
      key: "faltas",
      icon: "fa-solid fa-user-xmark",
      title: "Aus\u00eancias registradas",
      value: toLocaleNumber(finalCurrentCounter.faltasTotal),
      caption: `${toLocaleNumber(finalCurrentCounter.justificadas)} justificada(s) no per\u00edodo.`,
      trend: buildTrend(finalCurrentCounter.faltasTotal, finalPreviousCounter.faltasTotal, {
        positiveWhen: "down",
      }),
      href: agendaHref,
    }),
    buildCard({
      key: "ajustes",
      icon: "fa-solid fa-rotate",
      title: "Remarca\u00e7\u00f5es em curso",
      value: toLocaleNumber(finalCurrentCounter.emAjuste),
      caption: "Consultas em negocia\u00e7\u00e3o ou ajuste com a fam\u00edlia.",
      trend: buildTrend(finalCurrentCounter.emAjuste, finalPreviousCounter.emAjuste, {
        positiveWhen: "down",
      }),
      href: agendaHref,
    }),
    buildCard({
      key: "relatorios",
      icon: "fa-solid fa-notes-medical",
      title: "Relat\u00f3rios lan\u00e7ados",
      value: toLocaleNumber(finalCurrentCounter.relatorios),
      caption: "Hist\u00f3ricos salvos pelos profissionais no recorte.",
      trend: buildTrend(finalCurrentCounter.relatorios, finalPreviousCounter.relatorios, {
        positiveWhen: "up",
      }),
    }),
    buildCard({
      key: "comparecimento",
      icon: "fa-solid fa-chart-line",
      title: "Taxa de comparecimento",
      value: `${finalCurrentCounter.comparecimento}%`,
      caption: "Presen\u00e7as sobre consultas v\u00e1lidas do per\u00edodo.",
      trend: buildTrend(finalCurrentCounter.comparecimento, finalPreviousCounter.comparecimento, {
        positiveWhen: "up",
      }),
      progress: {
        value: Math.min(100, Math.max(0, finalCurrentCounter.comparecimento)),
        label: `${finalCurrentCounter.comparecimento}% de convers\u00e3o em atendimento realizado`,
      },
    }),
  ];

  const highlights = [
    {
      icon: "fa-solid fa-trophy",
      title: selectedProfessionalObjectId ? "Maior recorr\u00eancia" : "Maior carteira ativa",
      value: rankingRows[0]
        ? `${rankingRows[0].label} \u2022 ${rankingRows[0].totalLabel}`
        : "Sem lideran\u00e7a no recorte",
      description: selectedProfessionalObjectId
        ? "Assistido ou fam\u00edlia com mais consultas no per\u00edodo."
        : "Profissional com maior volume de consultas no per\u00edodo.",
    },
    {
      icon: "fa-solid fa-triangle-exclamation",
      title: "Ponto de aten\u00e7\u00e3o",
      value: highestAbsenceRow
        ? `${highestAbsenceRow.label} \u2022 ${highestAbsenceRow.absenceRate}% de aus\u00eancias`
        : "Sem aus\u00eancias relevantes",
      description: "Ajuda a identificar agenda com mais risco de n\u00e3o comparecimento.",
    },
    {
      icon: "fa-solid fa-calendar-week",
      title: "Dia mais aquecido",
      value: busiestWeekday?.total
        ? `${busiestWeekday.label} \u2022 ${busiestWeekday.totalLabel} consulta(s)`
        : "Sem concentra\u00e7\u00e3o definida",
      description: "Mostra onde a opera\u00e7\u00e3o est\u00e1 mais carregada durante a semana.",
    },
    {
      icon: "fa-solid fa-file-circle-check",
      title: "Cobertura de relat\u00f3rios",
      value: `${reportCoverage}%`,
      description: "Percentual de consultas com hist\u00f3rico lan\u00e7ado no per\u00edodo.",
    },
  ];

  const detailTable = {
    overline: selectedProfessionalObjectId ? "Assistidos e fam\u00edlias" : "Comparativo da equipe",
    title: selectedProfessionalObjectId
      ? "Quem mais passou pela agenda deste profissional"
      : "Performance por profissional no per\u00edodo",
    subtitle: selectedProfessionalObjectId
      ? "Veja volume, faltas, relat\u00f3rios e taxa de comparecimento por assistido ou fam\u00edlia vinculada."
      : "Compare consultas, faltas, remarca\u00e7\u00f5es e cobertura de relat\u00f3rios entre os profissionais.",
    modeLabel: selectedProfessionalObjectId ? "Vis\u00e3o do profissional" : "Toda a equipe",
    rows: rankingRows,
    emptyMessage: "Nenhuma consulta encontrada para este recorte.",
  };

  return {
    title: "Relat\u00f3rios",
    sectionTitle: "Dashboard de Consultas",
    navKey: "relatorios-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard page-consulta-dashboard",
    extraCss: ["/css/dashboard.css", "/css/consultation-dashboard.css"],
    extraJs: ["/js/consultation-dashboard.js"],
    header,
    filters: {
      action: "/relatorios/consultas",
      periodo: period.preset,
      periodoOptions: period.options,
      dataInicio: period.startInput,
      dataFim: period.endInput,
      professionalId: scopedProfessionalId || "",
      professionalOptions,
      canViewAll: canViewAllAgenda,
    },
    summaryCards,
    timelinePanel: {
      title: "Evolu\u00e7\u00e3o das consultas e do comparecimento",
      subtitle:
        timelineModel.granularity === "month"
          ? "Leitura mensal do volume, das presen\u00e7as e das aus\u00eancias."
          : timelineModel.granularity === "week"
            ? "Leitura semanal para entender picos de carga e quedas de comparecimento."
            : "Leitura di\u00e1ria das consultas do per\u00edodo selecionado.",
      kpis: [
        { label: "Consultas", value: toLocaleNumber(finalCurrentCounter.total) },
        { label: "Presen\u00e7as", value: toLocaleNumber(finalCurrentCounter.presentes) },
        { label: "Faltas + justificadas", value: toLocaleNumber(finalCurrentCounter.faltasTotal) },
      ],
      legend: [
        { key: "total", label: "Consultas", color: "#b24a32" },
        { key: "presentes", label: "Presen\u00e7as", color: "#16a34a" },
        { key: "faltas", label: "Faltas + justificadas", color: "#ef4444" },
      ],
    },
    statusDistribution,
    rankingPanel: {
      overline: selectedProfessionalObjectId ? "Carteira atendida" : "Carga por profissional",
      title: selectedProfessionalObjectId
        ? "Assistidos e fam\u00edlias mais recorrentes"
        : "Quem concentrou mais consultas no recorte",
      subtitle: selectedProfessionalObjectId
        ? "Bom para entender recorr\u00eancia, comparecimento e rela\u00e7\u00e3o entre consultas e relat\u00f3rios."
        : "Veja rapidamente quem est\u00e1 com maior volume e qual alcance cada agenda teve.",
      items: rankingTop,
      emptyMessage: "Nenhum comparativo dispon\u00edvel para este filtro.",
    },
    weekdayRows,
    weekdayDetailHref: buildWeekdayAnalysisHref({
      mes: period.end.getMonth() + 1,
      ano: period.end.getFullYear(),
      responsavelId: scopedProfessionalId || "",
    }),
    typeRows,
    highlights,
    detailTable,
    emptyStates: {
      distribution: "Nenhuma consulta encontrada no per\u00edodo.",
      timeline: "Nenhuma consulta encontrada no per\u00edodo.",
      ranking: "Nenhum comparativo dispon\u00edvel.",
      weekday: "Sem distribui\u00e7\u00e3o por dia da semana.",
      type: "Sem tipos de atendimento registrados.",
      table: "Nenhuma linha dispon\u00edvel para comparar.",
    },
    consultationDashboardData: {
      timeline: {
        series: timelineModel.buckets,
        meta: {
          total: { label: "Consultas", color: "#b24a32" },
          presentes: { label: "Presen\u00e7as", color: "#16a34a" },
          faltas: { label: "Faltas + justificadas", color: "#ef4444" },
        },
      },
    },
  };
}

function buildConsultationAnalyticsFallbackViewModel(req, message) {
  return buildEmptyViewModel(req, message);
}

module.exports = {
  buildConsultationAnalyticsViewModel,
  buildConsultationAnalyticsFallbackViewModel,
};
