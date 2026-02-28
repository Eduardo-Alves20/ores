const Familia = require("../schemas/Familia");
const { Paciente } = require("../schemas/Paciente");
const { Atendimento } = require("../schemas/Atendimento");

function monthRange(baseDate = new Date(), shiftMonths = 0) {
  const ref = new Date(baseDate.getFullYear(), baseDate.getMonth() + shiftMonths, 1, 0, 0, 0, 0);
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function dayRange(baseDate = new Date()) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

function formatShortDate(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  const dia = String(dt.getDate()).padStart(2, "0");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${dia} ${meses[dt.getMonth()]}, ${dt.getFullYear()}`;
}

class DashboardController {
  static async index(req, res) {
    try {
      const now = new Date();
      const mesAtual = monthRange(now, 0);
      const mesAnterior = monthRange(now, -1);
      const hoje = dayRange(now);

      const [totalDependentesAtivos, cadastrosMesAtual, cadastrosMesAnterior, atendimentosHoje, familiasRecentes] =
        await Promise.all([
          Paciente.countDocuments({ ativo: true }),
          Familia.countDocuments({ createdAt: { $gte: mesAtual.start, $lt: mesAtual.end } }),
          Familia.countDocuments({ createdAt: { $gte: mesAnterior.start, $lt: mesAnterior.end } }),
          Atendimento.countDocuments({ ativo: true, dataHora: { $gte: hoje.start, $lt: hoje.end } }),
          Familia.find({})
            .sort({ createdAt: -1 })
            .limit(14)
            .select("_id responsavel createdAt ativo")
            .lean(),
        ]);

      let hintCadastros = "Sem base comparativa no mes anterior";
      if (cadastrosMesAnterior > 0) {
        const delta = ((cadastrosMesAtual - cadastrosMesAnterior) / cadastrosMesAnterior) * 100;
        const sinal = delta >= 0 ? "+" : "";
        hintCadastros = `${sinal}${delta.toFixed(1)}% vs mes anterior`;
      } else if (cadastrosMesAtual === 0) {
        hintCadastros = "Sem novos cadastros no periodo";
      }

      const cards = [
        {
          icon: "fa-regular fa-users",
          title: "Total de Dependentes Ativos",
          value: Number(totalDependentesAtivos || 0).toLocaleString("pt-BR"),
          hint: "Total acumulado ativo na base",
        },
        {
          icon: "fa-regular fa-user-plus",
          title: "Novos cadastros (mes)",
          value: Number(cadastrosMesAtual || 0).toLocaleString("pt-BR"),
          hint: hintCadastros,
        },
        {
          icon: "fa-regular fa-calendar-check",
          title: "Atendimentos hoje",
          value: Number(atendimentosHoje || 0).toLocaleString("pt-BR"),
          hint: "Agenda do dia",
        },
      ];

      const cadastros = (familiasRecentes || []).map((familia) => ({
        nome: String(familia?.responsavel?.nome || "SEM NOME").toUpperCase(),
        status: familia?.ativo ? "ATIVO" : "INATIVO",
        data: formatShortDate(familia?.createdAt),
        responsavel: String(familia?.responsavel?.nome || "-").toUpperCase(),
      }));

      return res.status(200).render("pages/painel/index", {
        title: "Painel",
        sectionTitle: "Tela de Inicio",
        navKey: "home",
        layout: "partials/app.ejs",
        pageClass: "page-dashboard",
        user: req?.session?.user || null,
        cards,
        cadastros,
      });
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      return res.status(500).render("pages/painel/index", {
        title: "Painel",
        sectionTitle: "Tela de Inicio",
        navKey: "home",
        layout: "partials/app.ejs",
        pageClass: "page-dashboard",
        user: req?.session?.user || null,
        cards: [
          { icon: "fa-regular fa-users", title: "Total de Dependentes Ativos", value: "0", hint: "Falha ao carregar" },
          { icon: "fa-regular fa-user-plus", title: "Novos cadastros (mes)", value: "0", hint: "Falha ao carregar" },
          { icon: "fa-regular fa-calendar-check", title: "Atendimentos hoje", value: "0", hint: "Falha ao carregar" },
        ],
        cadastros: [],
      });
    }
  }
}

module.exports = DashboardController;

