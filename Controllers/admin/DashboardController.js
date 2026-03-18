const { buildDashboardViewModel } = require("../../services/admin/dashboardPageService");

class DashboardController {
  static async index(req, res) {
    try {
      const viewModel = await buildDashboardViewModel(req);
      return res.status(200).render("pages/painel/index", viewModel);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      return res.status(500).render("pages/painel/index", {
        title: "Painel",
        sectionTitle: "Painel Administrativo",
        navKey: "home",
        layout: "partials/app.ejs",
        pageClass: "page-dashboard",
        extraCss: ["/css/dashboard.css"],
        extraJs: ["/js/dashboard-home.js"],
        hero: {
          greeting: "Painel temporariamente indisponivel",
          subtitle: "Nao foi possivel montar os indicadores agora. Tente novamente em instantes.",
          stats: [
            { label: "Atualizado em", value: "-" },
            { label: "Compromissos hoje", value: "0" },
            { label: "Pendencias do dia", value: "0" },
          ],
          search: {
            enabled: false,
            action: "/familias",
            placeholder: "Buscar responsavel, assistido ou telefone...",
            canUseSuggestions: false,
          },
          quickActions: [],
        },
        summaryCards: [
          {
            key: "dependentes-ativos",
            icon: "fa-solid fa-people-group",
            title: "Dependentes ativos",
            value: "0",
            caption: "Falha ao carregar os indicadores da base",
            trend: { direction: "flat", tone: "neutral", label: "Falha ao carregar" },
            progress: null,
            href: "",
          },
          {
            key: "cadastros-mes",
            icon: "fa-solid fa-user-plus",
            title: "Novos cadastros no mes",
            value: "0",
            caption: "Falha ao carregar os indicadores do periodo",
            trend: { direction: "flat", tone: "neutral", label: "Falha ao carregar" },
            progress: null,
            href: "",
          },
          {
            key: "atendimentos-hoje",
            icon: "fa-solid fa-calendar-check",
            title: "Atendimentos hoje",
            value: "0",
            caption: "Falha ao carregar a agenda do dia",
            trend: null,
            progress: { value: 0, label: "Falha ao carregar" },
            href: "",
          },
          {
            key: "comparecimento",
            icon: "fa-solid fa-user-check",
            title: "Taxa de comparecimento",
            value: "0%",
            caption: "Falha ao carregar o indicador de presenca",
            trend: { direction: "flat", tone: "neutral", label: "Falha ao carregar" },
            progress: null,
            href: "",
          },
        ],
        alerts: [
          {
            icon: "fa-solid fa-triangle-exclamation",
            tone: "warning",
            value: "0",
            label: "Erro ao carregar painel",
            description: "Os blocos foram exibidos em modo de contingencia.",
            href: "",
          },
        ],
        charts: {
          timeline: {
            title: "Evolucao de cadastros e atendimentos",
            subtitle: "Dados indisponiveis no momento.",
            series6: [],
            series12: [],
            totals: {
              cadastros6: 0,
              atendimentos6: 0,
            },
          },
          distribution: {
            title: "Status da agenda do mes",
            subtitle: "Dados indisponiveis no momento.",
            total: 0,
            gradient: "conic-gradient(#dbe4f0 0 100%)",
            items: [],
          },
          teamLoad: {
            title: "Carga da equipe nos ultimos 30 dias",
            subtitle: "Dados indisponiveis no momento.",
            items: [],
          },
        },
        highlights: [],
        recentRows: [],
        viewFlags: {
          canViewFamilies: false,
        },
        emptyStates: {
          recentRows: "Nao foi possivel carregar os cadastros recentes.",
          teamLoad: "Nao foi possivel carregar a carga da equipe.",
          distribution: "Nao foi possivel carregar a distribuicao da agenda.",
        },
        dashboardData: {
          timeline: {
            series6: [],
            series12: [],
          },
          search: {
            enabled: false,
            endpoint: "/busca",
          },
        },
      });
    }
  }
}

module.exports = DashboardController;
