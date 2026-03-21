const {
  loadPortalFamilyDashboardAppointments,
} = require("./portalFamilyAppointmentService");
const {
  buildPortalFamilyAgendaPageView,
} = require("./portalFamilyAgendaService");
const {
  buildPortalFamilyNotificationsPageView,
} = require("./portalFamilyNotificationService");
const {
  formatAddress,
} = require("./portalFamilyFormattingService");

async function buildPortalFamilyHomePageView(context = {}) {
  const appointments = await loadPortalFamilyDashboardAppointments(context?.familia?._id);
  const notificationSummary = context?.notificationSummary || {
    total: 0,
    unread: 0,
    alerts: 0,
    recent: [],
  };

  return {
    title: "Portal da Familia",
    sectionTitle: "Portal da Familia",
    navKey: "minha-familia-home",
    layout: "partials/app.ejs",
    pageClass: "page-usuario-minha-familia-home",
    extraCss: ["/css/usuario-familia.css"],
    usuario: context?.usuario || null,
    familia: context?.familia || null,
    notificationCount: notificationSummary.unread || 0,
    dependentes: context?.dependentesCards || [],
    resumoFamilia: {
      responsavel: context?.familia?.responsavel?.nome || "-",
      parentesco: context?.familia?.responsavel?.parentesco || "-",
      telefone: context?.familia?.responsavel?.telefone || "-",
      email: context?.familia?.responsavel?.email || "-",
      endereco: formatAddress(context?.familia?.endereco),
    },
    totais: {
      dependentes: Number(context?.dependentesCards?.length || 0),
      proximasConsultas: Number(appointments?.totais?.upcoming || 0),
      consultasRealizadas: Number(appointments?.totais?.completed || 0),
      faltas: Number(appointments?.totais?.missed || 0),
      notificacoes: Number(notificationSummary?.unread || 0),
    },
    proximasConsultas: appointments?.proximasConsultas || [],
    historicoRecente: appointments?.historicoRecente || [],
    notificacoesRecentes: notificationSummary?.recent || [],
  };
}

async function buildPortalFamilyConsultasPageView(context = {}, query = {}) {
  return buildPortalFamilyAgendaPageView(context, query);
}

async function buildPortalFamilyNotificacoesPageView(context = {}, query = {}) {
  const view = await buildPortalFamilyNotificationsPageView({
    userId: context?.userId || null,
    query,
  });

  return {
    ...view,
    notificacoesRecentes: context?.notificationSummary?.recent || [],
  };
}

module.exports = {
  buildPortalFamilyConsultasPageView,
  buildPortalFamilyHomePageView,
  buildPortalFamilyNotificacoesPageView,
};
