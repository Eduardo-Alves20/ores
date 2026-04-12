const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { listPresenceReasons } = require("../../shared/systemConfigService");
const {
  getMonthRange,
  parseDateInput,
} = require("../../agenda/domain/agendaDateValueService");
const {
  mapPortalFamilyAgendaEvent,
} = require("./portalFamilyFormattingService");

function normalizeMonthReference(dateLike) {
  const parsed = parseDateInput(dateLike) || new Date();
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12, 0, 0, 0);
}

async function resolveAgendaReferenceDate({ familiaId, query = {} }) {
  const explicitReference = parseDateInput(query?.referencia);
  if (explicitReference) return normalizeMonthReference(explicitReference);

  const highlightedEventId = String(query?.evento || "").trim();
  if (!familiaId || !highlightedEventId) return normalizeMonthReference(new Date());

  const highlightedEvent = await AgendaEvento.findOne({
    _id: highlightedEventId,
    familiaId,
  })
    .select("_id inicio")
    .lean();

  if (!highlightedEvent?.inicio) return normalizeMonthReference(new Date());
  return normalizeMonthReference(highlightedEvent.inicio);
}

function buildMonthSummary(eventos = [], now = new Date()) {
  const summary = {
    total: 0,
    upcoming: 0,
    attended: 0,
    missed: 0,
    pending: 0,
    cancelled: 0,
  };

  (Array.isArray(eventos) ? eventos : []).forEach((evento) => {
    summary.total += 1;

    const inicio = parseDateInput(evento?.inicio);
    const statusPresenca = String(evento?.statusPresenca || "pendente").trim();
    const statusAgendamento = String(evento?.statusAgendamento || "agendado").trim();

    if (inicio && inicio >= now && statusAgendamento !== "cancelado") {
      summary.upcoming += 1;
    }

    if (statusPresenca === "presente") {
      summary.attended += 1;
      return;
    }

    if (["falta", "falta_justificada"].includes(statusPresenca)) {
      summary.missed += 1;
      return;
    }

    if (
      statusAgendamento === "cancelado" ||
      statusPresenca === "cancelado_antecipadamente"
    ) {
      summary.cancelled += 1;
      return;
    }

    summary.pending += 1;
  });

  return summary;
}

async function loadPortalFamilyAgendaMonthData({ familiaId, query = {} }) {
  const referenceDate = await resolveAgendaReferenceDate({ familiaId, query });
  const { inicio, fim } = getMonthRange({ referencia: referenceDate });

  if (!familiaId) {
    return {
      referenceDate,
      inicio,
      fim,
      resumo: buildMonthSummary([]),
      eventos: [],
      highlightEventId: String(query?.evento || "").trim(),
    };
  }

  const eventos = await AgendaEvento.find({
    familiaId,
    inicio: {
      $gte: inicio,
      $lt: fim,
    },
  })
    .sort({ inicio: 1, createdAt: 1 })
    .populate("responsavelId", "_id nome perfil email telefone")
    .populate("pacienteId", "_id nome")
    .populate("salaId", "_id nome descricao ativo")
    .lean();

  return {
    referenceDate,
    inicio,
    fim,
    resumo: buildMonthSummary(eventos),
    eventos: eventos.map(mapPortalFamilyAgendaEvent),
    highlightEventId: String(query?.evento || "").trim(),
  };
}

async function buildPortalFamilyAgendaPageView(context = {}, query = {}) {
  const monthData = await loadPortalFamilyAgendaMonthData({
    familiaId: context?.familia?._id || null,
    query,
  });
  const justifications = await listPresenceReasons({ includeInactive: false });

  return {
    title: "Agenda da Familia",
    sectionTitle: "Agenda da Familia",
    navKey: "minha-familia-consultas",
    layout: "partials/app.ejs",
    pageClass: "page-usuario-minha-familia-consultas page-family-agenda",
    extraCss: [
      "/css/agenda.css",
      "/css/usuario-familia.css",
      "/css/usuario-familia-agenda.css",
    ],
    extraJs: [
      "/js/agenda-shared.js",
      "/js/agenda-attendance.js",
      "/js/portal-family-agenda.js",
    ],
    familia: context?.familia || null,
    notificationCount: Number(context?.notificationSummary?.unread || 0),
    totais: monthData.resumo,
    attendanceJustifications: justifications.filter((item) =>
      !Array.isArray(item?.aplicaEm) ||
      !item.aplicaEm.length ||
      item.aplicaEm.includes("falta_justificada")
    ),
    familyAgendaConfig: {
      eventsEndpoint: "/minha-familia/consultas/eventos",
      absenceEndpoint: "/minha-familia/consultas/eventos",
      rescheduleEndpoint: "/minha-familia/consultas/eventos",
      referenceDate: monthData.referenceDate
        ? monthData.referenceDate.toISOString()
        : new Date().toISOString(),
      highlightEventId: monthData.highlightEventId,
      initialData: {
        resumo: monthData.resumo,
        eventos: monthData.eventos,
      },
    },
  };
}

module.exports = {
  buildMonthSummary,
  buildPortalFamilyAgendaPageView,
  loadPortalFamilyAgendaMonthData,
  normalizeMonthReference,
  resolveAgendaReferenceDate,
};
