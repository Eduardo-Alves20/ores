const mongoose = require("mongoose");
const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const {
  FAMILY_APPOINTMENT_LIMIT_OPTIONS,
} = require("./portalFamilyPolicyService");
const { mapAppointmentCard } = require("./portalFamilyFormattingService");

const HISTORY_STATUS_LIST = Object.freeze(["cancelado", "encerrado", "remarcado"]);

function parseAppointmentLimit(value, fallback = 12) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (FAMILY_APPOINTMENT_LIMIT_OPTIONS.includes(parsed)) return parsed;
  return fallback;
}

function parseAppointmentStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const allowed = [
    "todos",
    "agendada",
    "compareceu",
    "faltou",
    "cancelada",
    "remarcada",
    "pendente",
  ];

  if (allowed.includes(normalized)) return normalized;
  return "todos";
}

function parseDependentFilter(value, dependentes = []) {
  const raw = String(value || "").trim();
  if (!raw) return "todos";

  const exists = dependentes.some((item) => String(item?._id || "") === raw);
  return exists ? raw : "todos";
}

function buildEventStatusFilter(status) {
  if (status === "agendada") {
    return [{ statusAgendamento: "agendado" }];
  }

  if (status === "compareceu") {
    return [{ statusPresenca: "presente" }];
  }

  if (status === "faltou") {
    return [{ statusPresenca: { $in: ["falta", "falta_justificada"] } }];
  }

  if (status === "cancelada") {
    return [{
      $or: [
        { statusAgendamento: "cancelado" },
        { statusPresenca: "cancelado_antecipadamente" },
        { ativo: false },
      ],
    }];
  }

  if (status === "remarcada") {
    return [{ statusAgendamento: "remarcado" }];
  }

  if (status === "pendente") {
    return [{ statusPresenca: "pendente", statusAgendamento: { $ne: "cancelado" } }];
  }

  return [];
}

function buildDependentFilter(dependenteId) {
  if (!dependenteId || dependenteId === "todos") return {};

  if (!mongoose.Types.ObjectId.isValid(dependenteId)) return {};
  return { pacienteId: dependenteId };
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function buildFamilyEventQuery({ familiaId, dependentFilter = {}, conditions = [] }) {
  const safeConditions = [{ familiaId }, dependentFilter]
    .concat(Array.isArray(conditions) ? conditions : [])
    .filter((item) => item && Object.keys(item).length);

  if (!safeConditions.length) return {};
  if (safeConditions.length === 1) return safeConditions[0];
  return { $and: safeConditions };
}

async function loadPortalFamilyDashboardAppointments(familiaId) {
  if (!familiaId) {
    return {
      proximasConsultas: [],
      historicoRecente: [],
      totais: {
        upcoming: 0,
        completed: 0,
        missed: 0,
      },
    };
  }

  const inicioHoje = startOfToday();

  const [upcomingDocs, recentDocs, upcoming, completed, missed] = await Promise.all([
    AgendaEvento.find({
      familiaId,
      ativo: true,
      inicio: { $gte: inicioHoje },
      statusAgendamento: { $ne: "cancelado" },
    })
      .populate("pacienteId", "_id nome")
      .populate("responsavelId", "_id nome")
      .populate("salaId", "_id nome")
      .sort({ inicio: 1 })
      .limit(4)
      .lean(),
    AgendaEvento.find({
      familiaId,
      $or: [
        { inicio: { $lt: inicioHoje } },
        { statusPresenca: { $ne: "pendente" } },
        { statusAgendamento: { $in: HISTORY_STATUS_LIST } },
        { ativo: false },
      ],
    })
      .populate("pacienteId", "_id nome")
      .populate("responsavelId", "_id nome")
      .populate("salaId", "_id nome")
      .sort({ inicio: -1 })
      .limit(5)
      .lean(),
    AgendaEvento.countDocuments({
      familiaId,
      ativo: true,
      inicio: { $gte: inicioHoje },
      statusAgendamento: { $ne: "cancelado" },
    }),
    AgendaEvento.countDocuments({
      familiaId,
      statusPresenca: "presente",
    }),
    AgendaEvento.countDocuments({
      familiaId,
      statusPresenca: { $in: ["falta", "falta_justificada"] },
    }),
  ]);

  return {
    proximasConsultas: upcomingDocs.map(mapAppointmentCard),
    historicoRecente: recentDocs.map(mapAppointmentCard),
    totais: {
      upcoming,
      completed,
      missed,
    },
  };
}

async function buildPortalFamilyAppointmentsPageView({
  familiaId,
  dependentes = [],
  query = {},
  notificationCount = 0,
}) {
  const limit = parseAppointmentLimit(query?.limit, 12);
  const status = parseAppointmentStatus(query?.status);
  const dependente = parseDependentFilter(query?.dependente, dependentes);
  const destaqueEventoId = String(query?.evento || "").trim();

  if (!familiaId) {
    return {
      title: "Consultas da Familia",
      sectionTitle: "Consultas da Familia",
      navKey: "minha-familia-consultas",
      layout: "partials/app.ejs",
      pageClass: "page-usuario-minha-familia-consultas",
      extraCss: ["/css/usuario-familia.css"],
      proximasConsultas: [],
      historicoConsultas: [],
      destaqueEventoId,
      notificationCount,
      totais: {
        upcoming: 0,
        missed: 0,
        attended: 0,
      },
      filtros: {
        status,
        dependente,
        limit,
        limitOptions: FAMILY_APPOINTMENT_LIMIT_OPTIONS,
        dependenteOptions: (dependentes || []).map((item) => ({
          value: String(item?._id || ""),
          label: item?.nome || "Dependente",
        })),
      },
    };
  }

  const inicioHoje = startOfToday();
  const dependentFilter = buildDependentFilter(dependente);
  const statusConditions = buildEventStatusFilter(status);

  const [proximasDocs, historicoDocs, proximasTotal, faltasTotal, compareceuTotal] = await Promise.all([
    AgendaEvento.find(
      buildFamilyEventQuery({
        familiaId,
        dependentFilter,
        conditions: [
          { ativo: true },
          { inicio: { $gte: inicioHoje } },
          ...statusConditions,
        ],
      })
    )
      .populate("pacienteId", "_id nome")
      .populate("responsavelId", "_id nome")
      .populate("salaId", "_id nome")
      .sort({ inicio: 1 })
      .limit(limit)
      .lean(),
    AgendaEvento.find(
      buildFamilyEventQuery({
        familiaId,
        dependentFilter,
        conditions: [
          ...statusConditions,
          {
            $or: [
              { inicio: { $lt: inicioHoje } },
              { statusPresenca: { $ne: "pendente" } },
              { statusAgendamento: { $in: HISTORY_STATUS_LIST } },
              { ativo: false },
            ],
          },
        ],
      })
    )
      .populate("pacienteId", "_id nome")
      .populate("responsavelId", "_id nome")
      .populate("salaId", "_id nome")
      .sort({ inicio: -1 })
      .limit(limit)
      .lean(),
    AgendaEvento.countDocuments({
      familiaId,
      ativo: true,
      inicio: { $gte: inicioHoje },
      ...dependentFilter,
    }),
    AgendaEvento.countDocuments({
      familiaId,
      ...dependentFilter,
      statusPresenca: { $in: ["falta", "falta_justificada"] },
    }),
    AgendaEvento.countDocuments({
      familiaId,
      ...dependentFilter,
      statusPresenca: "presente",
    }),
  ]);

  return {
    title: "Consultas da Familia",
    sectionTitle: "Consultas da Familia",
    navKey: "minha-familia-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-usuario-minha-familia-consultas",
    extraCss: ["/css/usuario-familia.css"],
    proximasConsultas: proximasDocs.map(mapAppointmentCard),
    historicoConsultas: historicoDocs.map(mapAppointmentCard),
    destaqueEventoId,
    notificationCount,
    totais: {
      upcoming: proximasTotal,
      missed: faltasTotal,
      attended: compareceuTotal,
    },
    filtros: {
      status,
      dependente,
      limit,
      limitOptions: FAMILY_APPOINTMENT_LIMIT_OPTIONS,
      dependenteOptions: (dependentes || []).map((item) => ({
        value: String(item?._id || ""),
        label: item?.nome || "Dependente",
      })),
    },
  };
}

module.exports = {
  buildPortalFamilyAppointmentsPageView,
  buildFamilyEventQuery,
  loadPortalFamilyDashboardAppointments,
  parseAppointmentLimit,
  parseAppointmentStatus,
};
