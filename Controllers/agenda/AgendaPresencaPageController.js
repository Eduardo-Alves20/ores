const {
  buildAssistidoRanking,
  buildCalendarControls,
  buildCalendarDays,
  buildFilterSummary,
  buildPresenceCounters,
  buildPresenceStatusOptions,
  buildProfissionalRanking,
  buildSeries,
  buildUltimasOcorrencias,
  mapDayEvents,
  toLongDateLabel,
  toMonthInputValue,
  toMonthLabel,
} = require("../../services/agenda/agendaPresenceMetricsService");
const {
  buildPresenceDetailView,
  loadPresenceContext,
} = require("../../services/agenda/agendaPresencePageService");
const {
  listPresenceReasons,
  listQuickFilters,
} = require("../../services/shared/systemConfigService");

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
