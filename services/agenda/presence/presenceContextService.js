const mongoose = require("mongoose");

const Usuario = require("../../../schemas/core/Usuario");
const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { PERFIS } = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");
const {
  getMonthRange,
  parseDateInput,
  parseMonthInput,
  sameMonth,
  toDateInputValue,
  toMonthInputValue,
} = require("./presenceDateService");
const {
  buildBasePresenceQuery,
  matchesPresenceFilters,
  parsePresenceStatusFilter,
} = require("./presenceFilterService");
const { buildPresenceCounters } = require("./presenceMetricHelpers");

function createPageError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || "").trim());
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

module.exports = {
  loadPresenceContext,
};
