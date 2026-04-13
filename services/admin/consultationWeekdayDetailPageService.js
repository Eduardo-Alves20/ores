const mongoose = require("mongoose");

const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { Atendimento } = require("../../schemas/social/Atendimento");
const Usuario = require("../../schemas/core/Usuario");
const { Paciente } = require("../../schemas/social/Paciente");
const Familia = require("../../schemas/social/Familia");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../shared/accessControlService");

const WEEKDAY_META = Object.freeze([
  { key: "todos", numericKey: null, label: "Todos os dias", shortLabel: "Todos" },
  { key: "0", numericKey: 0, label: "Domingo", shortLabel: "Dom" },
  { key: "1", numericKey: 1, label: "Segunda-feira", shortLabel: "Seg" },
  { key: "2", numericKey: 2, label: "Terça-feira", shortLabel: "Ter" },
  { key: "3", numericKey: 3, label: "Quarta-feira", shortLabel: "Qua" },
  { key: "4", numericKey: 4, label: "Quinta-feira", shortLabel: "Qui" },
  { key: "5", numericKey: 5, label: "Sexta-feira", shortLabel: "Sex" },
  { key: "6", numericKey: 6, label: "Sábado", shortLabel: "Sáb" },
]);

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

const TABLE_PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50]);
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toIdString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function toObjectId(value) {
  const raw = String(value || "").trim();
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
}

function normalizeSearchTerm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function buildQueryString(input = {}) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    const normalized = String(value ?? "").trim();
    if (!normalized || normalized === "todos") return;
    params.set(key, normalized);
  });
  const output = params.toString();
  return output ? `?${output}` : "";
}

function buildWeekdayAnalysisHref(query = {}, overrides = {}) {
  return `/relatorios/consultas/distribuicao-semana${buildQueryString({
    mes: query?.mes,
    ano: query?.ano,
    responsavelId: query?.responsavelId,
    buscaPaciente: query?.buscaPaciente,
    diaSemana: query?.diaSemana,
    status: query?.status,
    relatorio: query?.relatorio,
    pagina: query?.pagina,
    limite: query?.limite,
    ...overrides,
  })}`;
}

function parsePositiveInt(value, fallback, options = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  const min = Number.isFinite(options.min) ? options.min : parsed;
  const max = Number.isFinite(options.max) ? options.max : parsed;
  return Math.min(max, Math.max(min, parsed));
}

function getMonthModel(query = {}) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const month = parsePositiveInt(query?.mes, currentMonth, { min: 1, max: 12 });
  const year = parsePositiveInt(query?.ano, currentYear, { min: currentYear - 5, max: currentYear + 2 });
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return {
    month,
    year,
    start,
    end,
    label: MONTH_LABEL_FORMATTER.format(start),
    monthOptions: Array.from({ length: 12 }, (_, index) => {
      const date = new Date(2026, index, 1);
      return {
        value: index + 1,
        label: MONTH_LABEL_FORMATTER.format(date).replace(/\s+\d{4}$/, "").replace(/^./, (char) => char.toUpperCase()),
      };
    }),
    yearOptions: Array.from({ length: 7 }, (_, index) => currentYear - 4 + index),
  };
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

function createCounter() {
  return {
    total: 0,
    presentes: 0,
    faltas: 0,
    pendentes: 0,
    emAjuste: 0,
    canceladas: 0,
    comRelatorio: 0,
  };
}

function finalizeCounter(counter) {
  const total = Number(counter?.total || 0);
  const canceladas = Number(counter?.canceladas || 0);
  return {
    ...counter,
    total,
    canceladas,
    comparecimento: toPercent(counter?.presentes, Math.max(1, total - canceladas)),
  };
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
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
}

function buildEmptyViewModel(message = "Não foi possível carregar a análise semanal.") {
  return {
    title: "Relatórios",
    sectionTitle: "Distribuição Semanal",
    navKey: "relatorios-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard page-consulta-dashboard page-consulta-weekday",
    extraCss: ["/css/dashboard.css", "/css/consultation-dashboard.css"],
    extraJs: ["/js/consultation-dashboard.js"],
    header: {
      title: "Distribuição semanal das consultas",
      subtitle: message,
      backHref: "/relatorios/consultas",
    },
    filters: {
      action: "/relatorios/consultas/distribuicao-semana",
      monthOptions: [],
      yearOptions: [],
      professionalOptions: [],
      weekdayOptions: WEEKDAY_META,
      statusOptions: STATUS_OPTIONS,
      reportOptions: REPORT_OPTIONS,
    },
    summaryCards: [],
    weekdayRows: [],
    patientRows: [],
    statusDistribution: { total: 0, totalLabel: "0", gradient: "conic-gradient(#e8dad1 0 100%)", items: [] },
    timelinePanel: { title: "Evolução do mês", subtitle: "Sem dados.", kpis: [], legend: [] },
    detailTable: {
      rows: [],
      summaryLabel: "0 resultados",
      pagination: { totalPages: 1, page: 1, hasPrevPage: false, hasNextPage: false, pages: [] },
      emptyMessage: message,
    },
    consultationDashboardData: { timeline: { series: [], meta: {} } },
  };
}

async function buildConsultationWeekdayDetailViewModel(req) {
  const permissions = getPermissionList(req);
  const actorId = getActorId(req);
  const canViewAllAgenda = hasAnyPermission(permissions, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const monthModel = getMonthModel(req?.query || {});
  const requestedProfessionalId = String(req?.query?.responsavelId || "").trim();
  const scopedProfessionalId = canViewAllAgenda ? requestedProfessionalId : actorId;
  const professionalObjectId = toObjectId(scopedProfessionalId);

  const patientSearch = String(req?.query?.buscaPaciente || "").trim();
  const patientSearchNormalized = normalizeSearchTerm(patientSearch);
  const weekdayFilter = WEEKDAY_META.some((item) => item.key === String(req?.query?.diaSemana || "").trim())
    ? String(req.query.diaSemana).trim()
    : "todos";
  const statusFilter = STATUS_OPTIONS.some((item) => item.value === String(req?.query?.status || "").trim())
    ? String(req.query.status).trim()
    : "todos";
  const reportFilter = REPORT_OPTIONS.some((item) => item.value === String(req?.query?.relatorio || "").trim())
    ? String(req.query.relatorio).trim()
    : "todos";
  const pageSize = TABLE_PAGE_SIZE_OPTIONS.includes(Number(req?.query?.limite)) ? Number(req.query.limite) : 20;

  const [professionalOptions, events, reports] = await Promise.all([
    canViewAllAgenda
      ? Usuario.find({ ativo: { $ne: false } }, "_id nome perfil").sort({ nome: 1 }).lean()
      : Promise.resolve([]),
    AgendaEvento.find(
      {
        ativo: true,
        ...(professionalObjectId ? { responsavelId: professionalObjectId } : {}),
        inicio: { $gte: monthModel.start, $lte: monthModel.end },
      },
      "_id titulo inicio local tipoAtendimento statusAgendamento statusPresenca familiaId pacienteId responsavelId"
    )
      .sort({ inicio: 1 })
      .lean(),
    Atendimento.find(
      {
        ativo: true,
        ...(professionalObjectId
          ? { $or: [{ profissionalId: professionalObjectId }, { criadoPor: professionalObjectId }] }
          : {}),
        dataHora: { $gte: monthModel.start, $lte: monthModel.end },
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

  const [patients, families, professionals] = await Promise.all([
    patientIds.size
      ? Paciente.find({ _id: { $in: Array.from(patientIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id nome matricula familiaId").lean()
      : Promise.resolve([]),
    familyIds.size
      ? Familia.find({ _id: { $in: Array.from(familyIds).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id responsavel").lean()
      : Promise.resolve([]),
    events.length
      ? Usuario.find({ _id: { $in: Array.from(new Set(events.map((item) => toIdString(item.responsavelId)).filter(Boolean))).map((id) => new mongoose.Types.ObjectId(id)) } }, "_id nome").lean()
      : Promise.resolve([]),
  ]);

  const patientMap = new Map(
    patients.map((item) => [
      toIdString(item._id),
      { _id: toIdString(item._id), nome: String(item.nome || "Assistido").trim(), matricula: String(item.matricula || "").trim(), familiaId: toIdString(item.familiaId) },
    ])
  );
  const familyMap = new Map(
    families.map((item) => [toIdString(item._id), { _id: toIdString(item._id), nome: String(item?.responsavel?.nome || "Família").trim() }])
  );
  const professionalMap = new Map(
    professionals.map((item) => [toIdString(item._id), { _id: toIdString(item._id), nome: String(item.nome || "Profissional").trim() }])
  );

  const reportKeys = new Set(
    reports.map((item) => [
      toIdString(item.profissionalId || item.criadoPor),
      toIdString(item.pacienteId),
      toIdString(item.familiaId),
      new Date(item.dataHora).toDateString(),
    ].join("|"))
  );

  const enrichedEvents = events.map((evento) => {
    const patientId = toIdString(evento.pacienteId);
    const familyId = toIdString(evento.familiaId);
    const patient = patientMap.get(patientId);
    const family = familyMap.get(familyId || patient?.familiaId);
    const professional = professionalMap.get(toIdString(evento.responsavelId));
    const classification = classifyEvent(evento);
    const hasReport = reportKeys.has([
      toIdString(evento.responsavelId),
      patientId,
      familyId,
      new Date(evento.inicio).toDateString(),
    ].join("|"));

    return {
      id: toIdString(evento._id),
      titulo: String(evento.titulo || "Consulta").trim() || "Consulta",
      inicio: evento.inicio,
      dayOfWeek: String(new Date(evento.inicio).getDay()),
      dayLabel: DATE_LABEL_FORMATTER.format(new Date(evento.inicio)),
      dateTimeLabel: DATE_TIME_FORMATTER.format(new Date(evento.inicio)),
      typeLabel: TYPE_META[String(evento.tipoAtendimento || "outro")] || "Outro",
      classification,
      patientName: patient?.nome || "Assistido não localizado",
      patientCode: patient?.matricula || "",
      familyName: family?.nome || "Família não localizada",
      professionalName: professional?.nome || "Profissional não localizado",
      hasReport,
      reportLabel: hasReport ? "Com relatório" : "Sem relatório",
      reportTone: hasReport ? "active" : "pending",
      presenceTone:
        classification === "presentes"
          ? "active"
          : classification === "faltas"
            ? "inactive"
            : classification === "canceladas"
              ? "neutral"
              : "pending",
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
      familyHref: family?._id ? `/familias/${family._id}` : "/agenda",
    };
  });

  const filteredEvents = enrichedEvents.filter((item) => {
    if (weekdayFilter !== "todos" && item.dayOfWeek !== weekdayFilter) return false;
    if (statusFilter !== "todos" && item.classification !== statusFilter) return false;
    if (reportFilter === "com" && !item.hasReport) return false;
    if (reportFilter === "sem" && item.hasReport) return false;
    if (!patientSearchNormalized) return true;
    const haystack = normalizeSearchTerm([
      item.titulo,
      item.patientName,
      item.patientCode,
      item.familyName,
      item.professionalName,
      item.typeLabel,
    ].join(" "));
    return haystack.includes(patientSearchNormalized);
  });

  const counter = createCounter();
  const weekdayCounters = new Map(WEEKDAY_META.slice(1).map((item) => [item.key, createCounter()]));
  const timelineMap = new Map();
  const patientRowsMap = new Map();

  filteredEvents.forEach((item) => {
    counter.total += 1;
    if (item.classification === "presentes") counter.presentes += 1;
    if (item.classification === "faltas") counter.faltas += 1;
    if (item.classification === "pendentes") counter.pendentes += 1;
    if (item.classification === "em_ajuste") counter.emAjuste += 1;
    if (item.classification === "canceladas") counter.canceladas += 1;
    if (item.hasReport) counter.comRelatorio += 1;

    const weekdayCounter = weekdayCounters.get(item.dayOfWeek);
    if (weekdayCounter) {
      weekdayCounter.total += 1;
      if (item.classification === "presentes") weekdayCounter.presentes += 1;
      if (item.classification === "faltas") weekdayCounter.faltas += 1;
      if (item.classification === "pendentes") weekdayCounter.pendentes += 1;
      if (item.classification === "em_ajuste") weekdayCounter.emAjuste += 1;
      if (item.classification === "canceladas") weekdayCounter.canceladas += 1;
      if (item.hasReport) weekdayCounter.comRelatorio += 1;
    }

    const dayKey = new Date(item.inicio).getDate();
    const dayBucket = timelineMap.get(dayKey) || { key: dayKey, label: String(dayKey).padStart(2, "0"), total: 0, presentes: 0, faltas: 0 };
    dayBucket.total += 1;
    if (item.classification === "presentes") dayBucket.presentes += 1;
    if (item.classification === "faltas") dayBucket.faltas += 1;
    timelineMap.set(dayKey, dayBucket);

    const patientKey = `${item.patientName}|${item.familyName}`;
    const patientBucket = patientRowsMap.get(patientKey) || {
      key: patientKey,
      label: item.patientName,
      subtitle: [item.patientCode, item.familyName].filter(Boolean).join(" • "),
      initials: toInitials(item.patientName, "FA"),
      total: 0,
      presentes: 0,
      faltas: 0,
      relatorios: 0,
      href: item.familyHref,
    };
    patientBucket.total += 1;
    if (item.classification === "presentes") patientBucket.presentes += 1;
    if (item.classification === "faltas") patientBucket.faltas += 1;
    if (item.hasReport) patientBucket.relatorios += 1;
    patientRowsMap.set(patientKey, patientBucket);
  });

  const finalCounter = finalizeCounter(counter);
  const weekdayRows = WEEKDAY_META.slice(1).map((item) => {
    const current = finalizeCounter(weekdayCounters.get(item.key) || createCounter());
    return {
      key: item.key,
      label: item.label,
      shortLabel: item.shortLabel,
      total: current.total,
      totalLabel: toLocaleNumber(current.total),
      presentesLabel: toLocaleNumber(current.presentes),
      faltasLabel: toLocaleNumber(current.faltas),
      ajusteLabel: toLocaleNumber(current.emAjuste),
      comparecimentoLabel: `${current.comparecimento}%`,
      share: finalCounter.total ? Math.max(8, Math.round((current.total / finalCounter.total) * 100)) : 0,
      href: buildWeekdayAnalysisHref(req?.query || {}, { diaSemana: item.key, pagina: 1 }),
      active: weekdayFilter === item.key,
    };
  });

  const patientRows = Array.from(patientRowsMap.values())
    .map((item) => ({
      ...item,
      totalLabel: toLocaleNumber(item.total),
      comparecimentoLabel: `${toPercent(item.presentes, item.total)}%`,
      faltasLabel: toLocaleNumber(item.faltas),
      relatoriosLabel: toLocaleNumber(item.relatorios),
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);

  const sortedRows = [...filteredEvents].sort((left, right) => new Date(right.inicio) - new Date(left.inicio));
  const currentPage = parsePositiveInt(req?.query?.pagina, 1, { min: 1, max: 9999 });
  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(currentPage, totalPages);
  const startIndex = totalItems ? (page - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const detailRows = sortedRows.slice(startIndex, endIndex);
  const pageItems = buildPageWindow(page, totalPages).map((number) => ({
    number,
    current: number === page,
    href: buildWeekdayAnalysisHref(req?.query || {}, { pagina: number }),
  }));

  const busiestWeekday = weekdayRows.slice().sort((left, right) => right.total - left.total)[0];
  const selectedWeekdayMeta = WEEKDAY_META.find((item) => item.key === weekdayFilter);

  const professionalLabel = scopedProfessionalId
    ? professionalOptions.find((item) => toIdString(item._id) === scopedProfessionalId)?.nome || "Profissional selecionado"
    : "Toda a equipe";

  const donutGradient = finalCounter.total
    ? `conic-gradient(#16a34a 0 ${toPercent(finalCounter.presentes, finalCounter.total)}%, #ef4444 ${toPercent(finalCounter.presentes, finalCounter.total)}% ${toPercent(finalCounter.presentes + finalCounter.faltas, finalCounter.total)}%, #3b82f6 ${toPercent(finalCounter.presentes + finalCounter.faltas, finalCounter.total)}% ${toPercent(finalCounter.presentes + finalCounter.faltas + finalCounter.pendentes, finalCounter.total)}%, #f59e0b ${toPercent(finalCounter.presentes + finalCounter.faltas + finalCounter.pendentes, finalCounter.total)}% ${toPercent(finalCounter.presentes + finalCounter.faltas + finalCounter.pendentes + finalCounter.emAjuste, finalCounter.total)}%, #94a3b8 ${toPercent(finalCounter.presentes + finalCounter.faltas + finalCounter.pendentes + finalCounter.emAjuste, finalCounter.total)}% 100%)`
    : "conic-gradient(#e8dad1 0 100%)";

  return {
    title: "Relatórios",
    sectionTitle: "Distribuição Semanal",
    navKey: "relatorios-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard page-consulta-dashboard page-consulta-weekday",
    extraCss: ["/css/dashboard.css", "/css/consultation-dashboard.css"],
    extraJs: ["/js/consultation-dashboard.js"],
    header: {
      title: "Distribuição semanal das consultas",
      subtitle: "Aprofunde a leitura por mês, profissional, paciente e dia da semana para entender concentração de agenda e comparecimento.",
      backHref: "/relatorios/consultas",
      stats: [
        { label: "Mês", value: monthModel.label.replace(/^./, (char) => char.toUpperCase()) },
        { label: "Profissional", value: professionalLabel },
        { label: "Recorte", value: selectedWeekdayMeta?.label || "Todos os dias" },
      ],
    },
    filters: {
      action: "/relatorios/consultas/distribuicao-semana",
      mes: monthModel.month,
      ano: monthModel.year,
      responsavelId: scopedProfessionalId || "",
      buscaPaciente: patientSearch,
      diaSemana: weekdayFilter,
      status: statusFilter,
      relatorio: reportFilter,
      limite: pageSize,
      monthOptions: monthModel.monthOptions,
      yearOptions: monthModel.yearOptions,
      professionalOptions: professionalOptions.map((item) => ({
        value: toIdString(item._id),
        label: `${item.nome} • ${item.perfil || "Profissional"}`,
      })),
      canViewAll: canViewAllAgenda,
      weekdayOptions: WEEKDAY_META,
      statusOptions: STATUS_OPTIONS,
      reportOptions: REPORT_OPTIONS,
    },
    summaryCards: [
      {
        icon: "fa-solid fa-calendar-week",
        title: "Consultas no mês",
        value: toLocaleNumber(finalCounter.total),
        caption: "Volume total do recorte filtrado.",
      },
      {
        icon: "fa-solid fa-user-check",
        title: "Comparecimento",
        value: `${finalCounter.comparecimento}%`,
        caption: `${toLocaleNumber(finalCounter.presentes)} presença(s) no mês.`,
      },
      {
        icon: "fa-solid fa-user-xmark",
        title: "Ausências",
        value: toLocaleNumber(finalCounter.faltas),
        caption: "Faltas e justificadas dentro do recorte.",
      },
      {
        icon: "fa-solid fa-calendar-day",
        title: "Dia mais carregado",
        value: busiestWeekday?.total ? `${busiestWeekday.shortLabel} • ${busiestWeekday.totalLabel}` : "Sem destaque",
        caption: "Ajuda a visualizar concentração da agenda no mês.",
      },
    ],
    timelinePanel: {
      title: "Evolução diária do mês",
      subtitle: "Veja como consultas, presenças e faltas se distribuem ao longo dos dias do mês selecionado.",
      kpis: [
        { label: "Consultas", value: toLocaleNumber(finalCounter.total) },
        { label: "Presenças", value: toLocaleNumber(finalCounter.presentes) },
        { label: "Com relatório", value: toLocaleNumber(finalCounter.comRelatorio) },
      ],
      legend: [
        { key: "total", label: "Consultas", color: "#b24a32" },
        { key: "presentes", label: "Presenças", color: "#16a34a" },
        { key: "faltas", label: "Faltas", color: "#ef4444" },
      ],
    },
    statusDistribution: {
      total: finalCounter.total,
      totalLabel: toLocaleNumber(finalCounter.total),
      gradient: donutGradient,
      items: [
        { label: "Presenças", color: "#16a34a", valueLabel: toLocaleNumber(finalCounter.presentes), share: toPercent(finalCounter.presentes, finalCounter.total) },
        { label: "Faltas", color: "#ef4444", valueLabel: toLocaleNumber(finalCounter.faltas), share: toPercent(finalCounter.faltas, finalCounter.total) },
        { label: "Pendentes", color: "#3b82f6", valueLabel: toLocaleNumber(finalCounter.pendentes), share: toPercent(finalCounter.pendentes, finalCounter.total) },
        { label: "Em ajuste", color: "#f59e0b", valueLabel: toLocaleNumber(finalCounter.emAjuste), share: toPercent(finalCounter.emAjuste, finalCounter.total) },
        { label: "Canceladas", color: "#94a3b8", valueLabel: toLocaleNumber(finalCounter.canceladas), share: toPercent(finalCounter.canceladas, finalCounter.total) },
      ],
    },
    weekdayRows,
    patientRows,
    detailTable: {
      rows: detailRows,
      summaryLabel: totalItems
        ? `Mostrando ${toLocaleNumber(startIndex + 1)} a ${toLocaleNumber(endIndex)} de ${toLocaleNumber(totalItems)} consulta(s)`
        : "Nenhuma consulta encontrada para esse recorte.",
      emptyMessage: "Nenhuma consulta encontrada para esse recorte.",
      pagination: {
        page,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevHref: page > 1 ? buildWeekdayAnalysisHref(req?.query || {}, { pagina: page - 1 }) : "",
        nextHref: page < totalPages ? buildWeekdayAnalysisHref(req?.query || {}, { pagina: page + 1 }) : "",
        pages: pageItems,
      },
      clearHref: buildWeekdayAnalysisHref(req?.query || {}, {
        buscaPaciente: "",
        diaSemana: "",
        status: "",
        relatorio: "",
        pagina: "",
      }),
      pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    },
    consultationDashboardData: {
      timeline: {
        series: Array.from(timelineMap.values()).sort((left, right) => left.key - right.key),
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
  buildConsultationWeekdayDetailViewModel,
  buildConsultationWeekdayFallbackViewModel: buildEmptyViewModel,
  buildWeekdayAnalysisHref,
};
