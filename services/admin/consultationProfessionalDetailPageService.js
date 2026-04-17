const mongoose = require("mongoose");

const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { Atendimento } = require("../../schemas/social/Atendimento");
const Usuario = require("../../schemas/core/Usuario");
const { Paciente } = require("../../schemas/social/Paciente");
const Familia = require("../../schemas/social/Familia");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../shared/accessControlService");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_OPTIONS = Object.freeze([
  { value: "todos", label: "Todos os status" },
  { value: "presentes", label: "Presenças" },
  { value: "faltas", label: "Faltas e justificadas" },
  { value: "pendentes", label: "Pendentes" },
  { value: "em_ajuste", label: "Em ajuste" },
  { value: "canceladas", label: "Canceladas" },
]);

const REPORT_OPTIONS = Object.freeze([
  { value: "todos", label: "Com e sem relatório" },
  { value: "com", label: "Somente com relatório" },
  { value: "sem", label: "Somente sem relatório" },
]);

const TYPE_META = Object.freeze({
  visita_domiciliar: "Visita domiciliar",
  atendimento_sede: "Atendimento na sede",
  entrega_beneficio: "Entrega de benefício",
  reuniao_equipe: "Reunião de equipe",
  outro: "Outro",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TABLE_PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50]);
const TABLE_ORDER_OPTIONS = Object.freeze([
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
]);

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

function toShortDateLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return SHORT_DATE_FORMATTER.format(date);
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

function parsePositiveInt(value, fallback, options = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  const min = Number.isFinite(options.min) ? options.min : parsed;
  const max = Number.isFinite(options.max) ? options.max : parsed;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSearchTerm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildPageWindow(currentPage, totalPages, windowSize = 5) {
  if (!Number(totalPages)) return [];
  const halfWindow = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - halfWindow);
  let end = Math.min(totalPages, start + windowSize - 1);

  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }

  const pages = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
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

  return {
    preset: effectivePreset,
    start,
    end,
    startInput: toLocalDateKey(start),
    endInput: toLocalDateKey(end),
    options: [
      { value: "7d", label: "Últimos 7 dias" },
      { value: "30d", label: "Últimos 30 dias" },
      { value: "90d", label: "Últimos 90 dias" },
      { value: "12m", label: "Últimos 12 meses" },
      { value: "custom", label: "Período customizado" },
    ],
  };
}

function getSessionUser(req) {
  return req?.currentUser || req?.session?.user || null;
}

function getPermissionList(req) {
  const user = getSessionUser(req);
  return Array.isArray(user?.permissions) ? user.permissions : [];
}

function getActorId(req) {
  const user = getSessionUser(req);
  return String(user?.id || user?._id || "").trim();
}

function classifyEvent(evento) {
  if (
    String(evento?.statusAgendamento || "") === "cancelado" ||
    String(evento?.statusPresenca || "") === "cancelado_antecipadamente"
  ) {
    return "canceladas";
  }

  if (String(evento?.statusAgendamento || "") === "em_negociacao_remarcacao") return "em_ajuste";
  if (String(evento?.statusPresenca || "") === "presente") return "presentes";
  if (["falta", "falta_justificada"].includes(String(evento?.statusPresenca || ""))) return "faltas";
  return "pendentes";
}

function resolvePresenceTone(statusKey) {
  if (statusKey === "presentes") return "active";
  if (statusKey === "faltas") return "inactive";
  if (statusKey === "em_ajuste") return "pending";
  if (statusKey === "canceladas") return "neutral";
  return "pending";
}

function buildQueryString(input = {}) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    const normalized = String(value || "").trim();
    if (!normalized || normalized === "todos") return;
    params.set(key, normalized);
  });
  const output = params.toString();
  return output ? `?${output}` : "";
}

function buildProfessionalAnalysisHref(professionalId, query = {}, overrides = {}) {
  const targetId = String(professionalId || "").trim();
  if (!targetId) return "/relatorios/consultas";

  return `/relatorios/consultas/profissional/${encodeURIComponent(targetId)}${buildQueryString({
    periodo: query?.periodo,
    dataInicio: query?.dataInicio,
    dataFim: query?.dataFim,
    status: query?.status,
    tipoAtendimento: query?.tipoAtendimento,
    relatorio: query?.relatorio,
    tableBusca: query?.tableBusca,
    tableStatus: query?.tableStatus,
    tableRelatorio: query?.tableRelatorio,
    tableOrdem: query?.tableOrdem,
    tableLimite: query?.tableLimite,
    tablePagina: query?.tablePagina,
    ...overrides,
  })}`;
}

function buildReportKey({ professionalId, patientId, familyId, dateLike }) {
  return [
    String(professionalId || "").trim(),
    String(patientId || "").trim(),
    String(familyId || "").trim(),
    toLocalDateKey(dateLike),
  ].join("|");
}

function buildEmptyViewModel(message = "Não foi possível carregar a análise do profissional.") {
  return {
    title: "Relatórios",
    sectionTitle: "Análise do Profissional",
    navKey: "relatorios-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard page-consulta-dashboard page-consulta-profissional",
    extraCss: ["/css/dashboard.css", "/css/consultation-dashboard.css"],
    extraJs: ["/js/consultation-dashboard.js"],
    header: {
      title: "Análise detalhada",
      subtitle: message,
      backHref: "/relatorios/consultas",
      agendaHref: "/agenda",
    },
    filters: {
      action: "",
      periodoOptions: [],
      statusOptions: STATUS_OPTIONS,
      reportOptions: REPORT_OPTIONS,
      typeOptions: [{ value: "todos", label: "Todos os tipos" }],
      tableBusca: "",
      tableStatus: "todos",
      tableRelatorio: "todos",
      tableOrdem: "recentes",
      tableLimite: 10,
    },
    quickCards: [],
    focusCards: [],
    insights: [],
    detailRows: [],
    detailTable: {
      action: "",
      rows: [],
      emptyMessage: message,
      statusOptions: STATUS_OPTIONS,
      reportOptions: REPORT_OPTIONS,
      orderOptions: TABLE_ORDER_OPTIONS,
      pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
      search: "",
      status: "todos",
      relatorio: "todos",
      ordem: "recentes",
      limite: 10,
      summaryLabel: "0 resultados",
      pagination: {
        page: 1,
        totalPages: 1,
        totalItems: 0,
        hasPrevPage: false,
        hasNextPage: false,
        prevHref: "",
        nextHref: "",
        pages: [],
      },
    },
    statusDistribution: {
      total: 0,
      totalLabel: "0",
      gradient: "conic-gradient(#e8dad1 0 100%)",
      items: [],
    },
    timelinePanel: {
      title: "Evolução",
      subtitle: "Sem dados no período.",
      kpis: [],
      legend: [],
    },
    consultationDashboardData: {
      timeline: {
        series: [],
        meta: {},
      },
    },
  };
}

async function buildProfessionalConsultationDetailViewModel(req) {
  const permissions = getPermissionList(req);
  const actorId = getActorId(req);
  const canViewAllAgenda = hasAnyPermission(permissions, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const requestedProfessionalId = String(req?.params?.professionalId || req?.query?.responsavelId || "").trim();
  const professionalId = canViewAllAgenda ? requestedProfessionalId : actorId;
  const professionalObjectId = toObjectId(professionalId);

  if (!professionalObjectId) {
    throw new Error("Profissional inválido para análise.");
  }

  const professional = await Usuario.findById(professionalObjectId, "_id nome perfil email").lean();
  if (!professional) {
    throw new Error("Profissional não encontrado.");
  }

  const period = buildPeriodModel(req?.query || {});
  const statusFilter = STATUS_OPTIONS.some((item) => item.value === String(req?.query?.status || "").trim())
    ? String(req.query.status).trim()
    : "todos";
  const typeFilter = TYPE_META[String(req?.query?.tipoAtendimento || "").trim()]
    ? String(req.query.tipoAtendimento).trim()
    : "todos";
  const reportFilter = REPORT_OPTIONS.some((item) => item.value === String(req?.query?.relatorio || "").trim())
    ? String(req.query.relatorio).trim()
    : "todos";
  const tableSearch = String(req?.query?.tableBusca || "").trim();
  const tableSearchNormalized = normalizeSearchTerm(tableSearch);
  const tableStatusFilter = STATUS_OPTIONS.some((item) => item.value === String(req?.query?.tableStatus || "").trim())
    ? String(req.query.tableStatus).trim()
    : "todos";
  const tableReportFilter = REPORT_OPTIONS.some((item) => item.value === String(req?.query?.tableRelatorio || "").trim())
    ? String(req.query.tableRelatorio).trim()
    : "todos";
  const tableOrder = TABLE_ORDER_OPTIONS.some((item) => item.value === String(req?.query?.tableOrdem || "").trim())
    ? String(req.query.tableOrdem).trim()
    : "recentes";
  const tableLimit = TABLE_PAGE_SIZE_OPTIONS.includes(Number(req?.query?.tableLimite))
    ? Number(req.query.tableLimite)
    : 10;

  const [events, reports] = await Promise.all([
    AgendaEvento.find(
      {
        ativo: true,
        responsavelId: professionalObjectId,
        inicio: { $gte: period.start, $lte: period.end },
      },
      "_id titulo inicio fim local tipoAtendimento statusAgendamento statusPresenca familiaId pacienteId"
    )
      .sort({ inicio: -1 })
      .lean(),
    Atendimento.find(
      {
        ativo: true,
        $or: [{ profissionalId: professionalObjectId }, { criadoPor: professionalObjectId }],
        dataHora: { $gte: period.start, $lte: period.end },
      },
      "_id dataHora familiaId pacienteId profissionalId criadoPor"
    ).lean(),
  ]);

  const patientIds = new Set(events.map((item) => toIdString(item.pacienteId)).filter(Boolean));
  const familyIds = new Set(events.map((item) => toIdString(item.familiaId)).filter(Boolean));
  reports.forEach((item) => {
    const patientId = toIdString(item.pacienteId);
    const familyId = toIdString(item.familiaId);
    if (patientId) patientIds.add(patientId);
    if (familyId) familyIds.add(familyId);
  });

  const [patients, families] = await Promise.all([
    patientIds.size
      ? Paciente.find({ _id: { $in: Array.from(patientIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id nome matricula familiaId").lean()
      : Promise.resolve([]),
    familyIds.size
      ? Familia.find({ _id: { $in: Array.from(familyIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id responsavel").lean()
      : Promise.resolve([]),
  ]);

  const patientMap = new Map(
    patients.map((item) => [
      toIdString(item._id),
      {
        _id: toIdString(item._id),
        nome: String(item.nome || "Assistido").trim() || "Assistido",
        matricula: String(item.matricula || "").trim(),
        familiaId: toIdString(item.familiaId),
      },
    ])
  );

  const familyMap = new Map(
    families.map((item) => [
      toIdString(item._id),
      {
        _id: toIdString(item._id),
        nome: String(item?.responsavel?.nome || "Família").trim() || "Família",
      },
    ])
  );

  const reportMap = new Map();
  reports.forEach((item) => {
    const patientId = toIdString(item.pacienteId);
    const familyId = toIdString(item.familiaId);
    const key = buildReportKey({
      professionalId,
      patientId,
      familyId,
      dateLike: item.dataHora,
    });
    reportMap.set(key, Number(reportMap.get(key) || 0) + 1);
  });

  const timelineMap = new Map();
  const counters = {
    total: 0,
    presentes: 0,
    faltas: 0,
    pendentes: 0,
    emAjuste: 0,
    canceladas: 0,
    comRelatorio: 0,
  };

  const enrichedEvents = events.map((evento) => {
    const patientId = toIdString(evento.pacienteId);
    const familyId = toIdString(evento.familiaId);
    const patient = patientMap.get(patientId);
    const family = familyMap.get(familyId || patient?.familiaId);
    const classification = classifyEvent(evento);
    const hasReport = reportMap.has(
      buildReportKey({
        professionalId,
        patientId,
        familyId,
        dateLike: evento.inicio,
      })
    );

    counters.total += 1;
    if (classification === "presentes") counters.presentes += 1;
    if (classification === "faltas") counters.faltas += 1;
    if (classification === "pendentes") counters.pendentes += 1;
    if (classification === "em_ajuste") counters.emAjuste += 1;
    if (classification === "canceladas") counters.canceladas += 1;
    if (hasReport) counters.comRelatorio += 1;

    const timelineKey = toLocalDateKey(evento.inicio);
    const bucket = timelineMap.get(timelineKey) || {
      key: timelineKey,
      label: toShortDateLabel(evento.inicio),
      total: 0,
      presentes: 0,
      faltas: 0,
    };
    bucket.total += 1;
    if (classification === "presentes") bucket.presentes += 1;
    if (classification === "faltas") bucket.faltas += 1;
    timelineMap.set(timelineKey, bucket);

    return {
      id: toIdString(evento._id),
      titulo: String(evento.titulo || "Consulta").trim() || "Consulta",
      inicio: evento.inicio,
      dateTimeLabel: DATE_TIME_FORMATTER.format(new Date(evento.inicio)),
      typeLabel: TYPE_META[String(evento.tipoAtendimento || "outro")] || "Outro",
      classification,
      presenceLabel:
        classification === "presentes"
          ? "Presença"
          : classification === "faltas"
            ? "Falta / justificada"
            : classification === "em_ajuste"
              ? "Em ajuste"
              : classification === "canceladas"
                ? "Cancelada"
                : "Pendente",
      presenceTone: resolvePresenceTone(classification),
      familyName: family?.nome || "Família não localizada",
      patientName: patient?.nome || family?.nome || "Assistido não localizado",
      patientCode: patient?.matricula || "",
      hasReport,
      reportLabel: hasReport ? "Com relatório" : "Sem relatório",
      reportTone: hasReport ? "active" : "pending",
      familyHref: family?._id ? `/familias/${family._id}` : `/agenda?responsavelId=${encodeURIComponent(professionalId)}`,
      agendaHref: `/agenda?responsavelId=${encodeURIComponent(professionalId)}`,
      familyId: family?._id || familyId || "",
      patientId,
      local: String(evento.local || "").trim() || "Instituto ORES",
    };
  });

  const filteredEvents = enrichedEvents.filter((item) => {
    if (statusFilter !== "todos" && item.classification !== statusFilter) return false;
    if (typeFilter !== "todos" && item.typeLabel !== (TYPE_META[typeFilter] || "")) return false;
    if (reportFilter === "com" && !item.hasReport) return false;
    if (reportFilter === "sem" && item.hasReport) return false;
    return true;
  });

  const tableFilteredEvents = filteredEvents.filter((item) => {
    if (tableStatusFilter !== "todos" && item.classification !== tableStatusFilter) return false;
    if (tableReportFilter === "com" && !item.hasReport) return false;
    if (tableReportFilter === "sem" && item.hasReport) return false;
    if (!tableSearchNormalized) return true;

    const searchTarget = normalizeSearchTerm([
      item.titulo,
      item.patientName,
      item.patientCode,
      item.familyName,
      item.typeLabel,
      item.reportLabel,
      item.presenceLabel,
      item.local,
      item.dateTimeLabel,
    ].join(" "));

    return searchTarget.includes(tableSearchNormalized);
  });

  const detailRowsSorted = [...tableFilteredEvents].sort((left, right) => {
    const leftDate = new Date(left.inicio).getTime();
    const rightDate = new Date(right.inicio).getTime();
    return tableOrder === "antigas" ? leftDate - rightDate : rightDate - leftDate;
  });

  const requestedTablePage = parsePositiveInt(req?.query?.tablePagina, 1, { min: 1, max: 9999 });
  const tableTotalItems = detailRowsSorted.length;
  const tableTotalPages = Math.max(1, Math.ceil(tableTotalItems / tableLimit));
  const tablePage = Math.min(requestedTablePage, tableTotalPages);
  const detailStartIndex = tableTotalItems ? (tablePage - 1) * tableLimit : 0;
  const detailEndIndex = Math.min(detailStartIndex + tableLimit, tableTotalItems);
  const detailRows = detailRowsSorted.slice(detailStartIndex, detailEndIndex);

  const buildCurrentDetailHref = (overrides = {}) =>
    buildProfessionalAnalysisHref(professionalId, req?.query || {}, overrides);

  const tablePages = buildPageWindow(tablePage, tableTotalPages).map((page) => ({
    number: page,
    current: page === tablePage,
    href: buildCurrentDetailHref({ tablePagina: page }),
  }));

  const filteredCounter = filteredEvents.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      if (item.classification === "presentes") accumulator.presentes += 1;
      if (item.classification === "faltas") accumulator.faltas += 1;
      if (item.classification === "pendentes") accumulator.pendentes += 1;
      if (item.classification === "em_ajuste") accumulator.emAjuste += 1;
      if (item.classification === "canceladas") accumulator.canceladas += 1;
      if (item.hasReport) accumulator.comRelatorio += 1;
      return accumulator;
    },
    { total: 0, presentes: 0, faltas: 0, pendentes: 0, emAjuste: 0, canceladas: 0, comRelatorio: 0 }
  );

  const comparecimento = toPercent(filteredCounter.presentes, Math.max(1, filteredCounter.total - filteredCounter.canceladas));
  const reportCoverage = toPercent(filteredCounter.comRelatorio, filteredCounter.total);

  const patientFocusMap = new Map();
  filteredEvents.forEach((item) => {
    const key = item.patientId || item.familyId || item.id;
    if (!patientFocusMap.has(key)) {
      patientFocusMap.set(key, {
        key,
        label: item.patientName,
        subtitle: [item.patientCode, item.familyName].filter(Boolean).join(" • "),
        initials: toInitials(item.patientName, "FA"),
        href: item.familyHref,
        total: 0,
        presentes: 0,
        faltas: 0,
        relatorios: 0,
        nextDate: "",
        lastDate: "",
      });
    }

    const bucket = patientFocusMap.get(key);
    bucket.total += 1;
    if (item.classification === "presentes") bucket.presentes += 1;
    if (item.classification === "faltas") bucket.faltas += 1;
    if (item.hasReport) bucket.relatorios += 1;
    const eventDate = new Date(item.inicio);
    if (eventDate >= new Date()) {
      if (!bucket.nextDate || eventDate < new Date(bucket.nextDate)) bucket.nextDate = eventDate.toISOString();
    } else if (!bucket.lastDate || eventDate > new Date(bucket.lastDate)) {
      bucket.lastDate = eventDate.toISOString();
    }
  });

  const focusCards = Array.from(patientFocusMap.values())
    .map((item) => ({
      ...item,
      comparecimentoLabel: `${toPercent(item.presentes, item.total)}%`,
      nextDateLabel: item.nextDate ? DATE_TIME_FORMATTER.format(new Date(item.nextDate)) : "Sem próxima consulta",
      lastDateLabel: item.lastDate ? DATE_TIME_FORMATTER.format(new Date(item.lastDate)) : "Sem histórico recente",
      totalLabel: toLocaleNumber(item.total),
      faltasLabel: toLocaleNumber(item.faltas),
      relatoriosLabel: toLocaleNumber(item.relatorios),
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);

  const quickCards = [
    { key: "todos", label: "Todas", value: counters.total, description: "Volume total no período" },
    { key: "presentes", label: "Presenças", value: counters.presentes, description: "Consultas concluídas" },
    { key: "faltas", label: "Faltas", value: counters.faltas, description: "Faltas e justificadas" },
    { key: "pendentes", label: "Pendentes", value: counters.pendentes, description: "Ainda sem definição" },
    { key: "em_ajuste", label: "Em ajuste", value: counters.emAjuste, description: "Remarcações em negociação" },
    { key: "com_relatorio", label: "Com relatório", value: counters.comRelatorio, description: "Com histórico lançado" },
  ].map((item) => ({
    ...item,
    valueLabel: toLocaleNumber(item.value),
    active:
      (item.key === "todos" && statusFilter === "todos" && reportFilter === "todos")
      || (item.key === statusFilter)
      || (item.key === "com_relatorio" && reportFilter === "com"),
    href:
      item.key === "com_relatorio"
        ? buildProfessionalAnalysisHref(professionalId, req?.query || {}, { relatorio: "com", status: "", tablePagina: 1 })
        : buildProfessionalAnalysisHref(professionalId, req?.query || {}, { status: item.key === "todos" ? "" : item.key, relatorio: "", tablePagina: 1 }),
  }));

  const dominantType = filteredEvents.reduce((accumulator, item) => {
    const current = accumulator[item.typeLabel] || 0;
    accumulator[item.typeLabel] = current + 1;
    return accumulator;
  }, {});

  const dominantTypeEntry = Object.entries(dominantType).sort((left, right) => right[1] - left[1])[0];

  const insights = [
    {
      icon: "fa-solid fa-chart-line",
      title: "Taxa de comparecimento",
      value: `${comparecimento}%`,
      description: "Considera apenas consultas válidas no recorte filtrado.",
    },
    {
      icon: "fa-solid fa-file-circle-check",
      title: "Cobertura de relatório",
      value: `${reportCoverage}%`,
      description: "Ajuda a enxergar quanto da agenda já virou histórico clínico.",
    },
    {
      icon: "fa-solid fa-layer-group",
      title: "Tipo dominante",
      value: dominantTypeEntry ? `${dominantTypeEntry[0]} • ${toLocaleNumber(dominantTypeEntry[1])}` : "Sem predominância",
      description: "Mostra a modalidade de atendimento que mais apareceu no período.",
    },
  ];

  const timelineSeries = Array.from(timelineMap.values()).sort((left, right) => left.key.localeCompare(right.key));

  return {
    title: "Relatórios",
    sectionTitle: "Análise do Profissional",
    navKey: "relatorios-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard page-consulta-dashboard page-consulta-profissional",
    extraCss: ["/css/dashboard.css", "/css/consultation-dashboard.css"],
    extraJs: ["/js/consultation-dashboard.js"],
    header: {
      title: `Análise detalhada de ${professional.nome}`,
      subtitle: "Aprofunde o recorte por status, tipo de atendimento e cobertura de relatório sem sair do dashboard.",
      backHref: `/relatorios/consultas${buildQueryString({
        periodo: req?.query?.periodo,
        dataInicio: req?.query?.dataInicio,
        dataFim: req?.query?.dataFim,
      })}`,
      agendaHref: `/agenda?responsavelId=${encodeURIComponent(professionalId)}`,
      stats: [
        { label: "Consultas filtradas", value: toLocaleNumber(filteredCounter.total) },
        { label: "Comparecimento", value: `${comparecimento}%` },
        { label: "Relatórios", value: toLocaleNumber(filteredCounter.comRelatorio) },
      ],
    },
    filters: {
      action: buildProfessionalAnalysisHref(professionalId),
      periodo: period.preset,
      dataInicio: period.startInput,
      dataFim: period.endInput,
      status: statusFilter,
      tipoAtendimento: typeFilter,
      relatorio: reportFilter,
      tableBusca: tableSearch,
      tableStatus: tableStatusFilter,
      tableRelatorio: tableReportFilter,
      tableOrdem: tableOrder,
      tableLimite: tableLimit,
      periodoOptions: period.options,
      statusOptions: STATUS_OPTIONS,
      reportOptions: REPORT_OPTIONS,
      typeOptions: [{ value: "todos", label: "Todos os tipos" }].concat(
        Object.entries(TYPE_META).map(([value, label]) => ({ value, label }))
      ),
    },
    quickCards,
    focusCards,
    insights,
    statusDistribution: {
      total: filteredCounter.total,
      totalLabel: toLocaleNumber(filteredCounter.total),
      gradient: filteredCounter.total
        ? `conic-gradient(#16a34a 0 ${toPercent(filteredCounter.presentes, filteredCounter.total)}%, #ef4444 ${toPercent(filteredCounter.presentes, filteredCounter.total)}% ${toPercent(filteredCounter.presentes + filteredCounter.faltas, filteredCounter.total)}%, #3b82f6 ${toPercent(filteredCounter.presentes + filteredCounter.faltas, filteredCounter.total)}% ${toPercent(filteredCounter.presentes + filteredCounter.faltas + filteredCounter.pendentes, filteredCounter.total)}%, #f59e0b ${toPercent(filteredCounter.presentes + filteredCounter.faltas + filteredCounter.pendentes, filteredCounter.total)}% ${toPercent(filteredCounter.presentes + filteredCounter.faltas + filteredCounter.pendentes + filteredCounter.emAjuste, filteredCounter.total)}%, #94a3b8 ${toPercent(filteredCounter.presentes + filteredCounter.faltas + filteredCounter.pendentes + filteredCounter.emAjuste, filteredCounter.total)}% 100%)`
        : "conic-gradient(#e8dad1 0 100%)",
      items: [
        { label: "Presenças", color: "#16a34a", valueLabel: toLocaleNumber(filteredCounter.presentes), share: toPercent(filteredCounter.presentes, filteredCounter.total) },
        { label: "Faltas", color: "#ef4444", valueLabel: toLocaleNumber(filteredCounter.faltas), share: toPercent(filteredCounter.faltas, filteredCounter.total) },
        { label: "Pendentes", color: "#3b82f6", valueLabel: toLocaleNumber(filteredCounter.pendentes), share: toPercent(filteredCounter.pendentes, filteredCounter.total) },
        { label: "Em ajuste", color: "#f59e0b", valueLabel: toLocaleNumber(filteredCounter.emAjuste), share: toPercent(filteredCounter.emAjuste, filteredCounter.total) },
        { label: "Canceladas", color: "#94a3b8", valueLabel: toLocaleNumber(filteredCounter.canceladas), share: toPercent(filteredCounter.canceladas, filteredCounter.total) },
      ],
    },
    timelinePanel: {
      title: "Evolução diária do profissional",
      subtitle: "Acompanhe como o filtro atual impacta volume, presença e faltas ao longo do período.",
      kpis: [
        { label: "Consultas", value: toLocaleNumber(filteredCounter.total) },
        { label: "Com relatório", value: toLocaleNumber(filteredCounter.comRelatorio) },
        { label: "Faltas", value: toLocaleNumber(filteredCounter.faltas) },
      ],
      legend: [
        { key: "total", label: "Consultas", color: "#b24a32" },
        { key: "presentes", label: "Presenças", color: "#16a34a" },
        { key: "faltas", label: "Faltas", color: "#ef4444" },
      ],
    },
    detailRows,
    detailTable: {
      action: buildProfessionalAnalysisHref(professionalId),
      rows: detailRows,
      search: tableSearch,
      status: tableStatusFilter,
      relatorio: tableReportFilter,
      ordem: tableOrder,
      limite: tableLimit,
      statusOptions: STATUS_OPTIONS,
      reportOptions: REPORT_OPTIONS,
      orderOptions: TABLE_ORDER_OPTIONS,
      pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
      summaryLabel: tableTotalItems
        ? `Mostrando ${toLocaleNumber(detailStartIndex + 1)} a ${toLocaleNumber(detailEndIndex)} de ${toLocaleNumber(tableTotalItems)} consulta(s)`
        : "Nenhuma consulta encontrada para os filtros da tabela.",
      clearHref: buildCurrentDetailHref({
        tableBusca: "",
        tableStatus: "",
        tableRelatorio: "",
        tableOrdem: "",
        tableLimite: "",
        tablePagina: "",
      }),
      pagination: {
        page: tablePage,
        totalPages: tableTotalPages,
        totalItems: tableTotalItems,
        hasPrevPage: tablePage > 1,
        hasNextPage: tablePage < tableTotalPages,
        prevHref: tablePage > 1 ? buildCurrentDetailHref({ tablePagina: tablePage - 1 }) : "",
        nextHref: tablePage < tableTotalPages ? buildCurrentDetailHref({ tablePagina: tablePage + 1 }) : "",
        pages: tablePages,
      },
      emptyMessage: "Nenhuma consulta encontrada com esse recorte para a tabela.",
    },
    emptyStateMessage: "Nenhuma consulta encontrada com esse recorte para o profissional.",
    consultationDashboardData: {
      timeline: {
        series: timelineSeries,
        meta: {
          total: { label: "Consultas", color: "#b24a32" },
          presentes: { label: "Presenças", color: "#16a34a" },
          faltas: { label: "Faltas", color: "#ef4444" },
        },
      },
    },
  };
}

module.exports = {
  buildProfessionalConsultationDetailViewModel,
  buildProfessionalAnalysisHref,
  buildProfessionalDetailFallbackViewModel: buildEmptyViewModel,
};
