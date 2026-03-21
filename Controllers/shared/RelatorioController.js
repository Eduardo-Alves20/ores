const Familia = require("../../schemas/social/Familia");
const { Atendimento } = require("../../schemas/social/Atendimento");
const {
  buildConsultationAnalyticsViewModel,
  buildConsultationAnalyticsFallbackViewModel,
} = require("../../services/admin/consultationAnalyticsPageService");
const {
  buildProfessionalConsultationDetailViewModel,
  buildProfessionalDetailFallbackViewModel,
} = require("../../services/admin/consultationProfessionalDetailPageService");
const {
  buildConsultationWeekdayDetailViewModel,
  buildConsultationWeekdayFallbackViewModel,
} = require("../../services/admin/consultationWeekdayDetailPageService");

function getPeriodo(req) {
  const meses = Math.min(Math.max(Number(req.query.meses) || 12, 1), 36);
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  inicio.setMonth(inicio.getMonth() - (meses - 1));
  return { inicio, meses };
}

class RelatorioController {
  static async cadastrosPorMes(req, res) {
    try {
      const { inicio, meses } = getPeriodo(req);

      const familias = await Familia.aggregate([
        { $match: { createdAt: { $gte: inicio } } },
        {
          $group: {
            _id: {
              ano: { $year: "$createdAt" },
              mes: { $month: "$createdAt" },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { "_id.ano": 1, "_id.mes": 1 } },
      ]);

      return res.status(200).json({
        periodoMeses: meses,
        serie: familias.map((row) => ({
          ano: row._id.ano,
          mes: row._id.mes,
          totalCadastros: row.total,
        })),
      });
    } catch (error) {
      console.error("Erro no relatorio de cadastros:", error);
      return res.status(500).json({ erro: "Erro interno no relatorio de cadastros." });
    }
  }

  static async atendimentosPorMes(req, res) {
    try {
      const { inicio, meses } = getPeriodo(req);

      const atendimentos = await Atendimento.aggregate([
        {
          $match: {
            dataHora: { $gte: inicio },
            ativo: true,
          },
        },
        {
          $group: {
            _id: {
              ano: { $year: "$dataHora" },
              mes: { $month: "$dataHora" },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { "_id.ano": 1, "_id.mes": 1 } },
      ]);

      return res.status(200).json({
        periodoMeses: meses,
        serie: atendimentos.map((row) => ({
          ano: row._id.ano,
          mes: row._id.mes,
          totalAtendimentos: row.total,
        })),
      });
    } catch (error) {
      console.error("Erro no relatorio de atendimentos:", error);
      return res.status(500).json({ erro: "Erro interno no relatorio de atendimentos." });
    }
  }

  static async dashboardConsultas(req, res) {
    try {
      const viewModel = await buildConsultationAnalyticsViewModel(req);
      return res.status(200).render("pages/relatorios/consultas-dashboard", viewModel);
    } catch (error) {
      console.error("Erro ao carregar dashboard de consultas:", error);
      return res.status(500).render(
        "pages/relatorios/consultas-dashboard",
        buildConsultationAnalyticsFallbackViewModel(
          req,
          "N\u00e3o foi poss\u00edvel montar o dashboard de consultas agora."
        )
      );
    }
  }

  static async dashboardConsultasProfissional(req, res) {
    try {
      const viewModel = await buildProfessionalConsultationDetailViewModel(req);
      return res.status(200).render("pages/relatorios/consultas-profissional", viewModel);
    } catch (error) {
      console.error("Erro ao carregar análise detalhada do profissional:", error);
      return res.status(500).render(
        "pages/relatorios/consultas-profissional",
        buildProfessionalDetailFallbackViewModel(
          "Não foi possível carregar a análise detalhada do profissional."
        )
      );
    }
  }

  static async dashboardConsultasDistribuicaoSemana(req, res) {
    try {
      const viewModel = await buildConsultationWeekdayDetailViewModel(req);
      return res.status(200).render("pages/relatorios/consultas-distribuicao-semana", viewModel);
    } catch (error) {
      console.error("Erro ao carregar análise semanal de consultas:", error);
      return res.status(500).render(
        "pages/relatorios/consultas-distribuicao-semana",
        buildConsultationWeekdayFallbackViewModel(
          "Não foi possível carregar a distribuição semanal de consultas."
        )
      );
    }
  }
}

module.exports = RelatorioController;
