const Familia = require("../../../schemas/social/Familia");
const { Paciente } = require("../../../schemas/social/Paciente");
const { Atendimento } = require("../../../schemas/social/Atendimento");
const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { escapeRegex } = require("../../shared/searchUtilsService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { buildFamilyFilters } = require("./portalUserFilterService");
const {
  USER_AGENDA_LIMIT,
  mapAgendaCard,
  mapDayLabel,
  mapMonthLabel,
  mapTipoAtendimentoLabel,
  mapTipoCadastroLabel,
  toIsoStringOrEmpty,
} = require("./portalUserFormattingService");

async function findLinkedFamily(usuario) {
  const email = String(usuario?.email || "").toLowerCase().trim();
  const telefone = String(usuario?.telefone || "").trim();

  const filtroFamilia = {
    $or: [{ "responsavel.email": email }],
  };

  if (telefone) {
    filtroFamilia.$or.push({ "responsavel.telefone": telefone });
  }

  return Familia.findOne(filtroFamilia).lean();
}

async function buildSearchClause(familiaId, busca) {
  if (!busca) return [];

  const buscaRegex = new RegExp(escapeRegex(busca), "i");
  const pacientesComBusca = await Paciente.find({
    familiaId,
    nome: { $regex: buscaRegex },
  })
    .select("_id")
    .lean();

  const pacienteIds = pacientesComBusca.map((item) => item?._id).filter(Boolean);
  const searchClause = [
    { resumo: { $regex: buscaRegex } },
    { proximosPassos: { $regex: buscaRegex } },
    { tipo: { $regex: buscaRegex } },
  ];

  if (pacienteIds.length) {
    searchClause.push({ pacienteId: { $in: pacienteIds } });
  }

  return searchClause;
}

async function buildAtendimentoFilter(familiaId, filtros) {
  const filtroAtendimento = {
    familiaId,
  };

  if (filtros.tipo !== "todos") {
    filtroAtendimento.tipo = filtros.tipo;
  }

  if (filtros.status === "ativo") {
    filtroAtendimento.ativo = true;
  } else if (filtros.status === "inativo") {
    filtroAtendimento.ativo = false;
  }

  if (filtros.dataInicio || filtros.dataFim) {
    filtroAtendimento.dataHora = {};
    if (filtros.dataInicio) {
      filtroAtendimento.dataHora.$gte = new Date(`${filtros.dataInicio}T00:00:00`);
    }
    if (filtros.dataFim) {
      filtroAtendimento.dataHora.$lte = new Date(`${filtros.dataFim}T23:59:59.999`);
    }
  }

  const searchClause = await buildSearchClause(familiaId, filtros.busca);
  if (searchClause.length) {
    filtroAtendimento.$or = searchClause;
  }

  return filtroAtendimento;
}

function buildTotals(atendimentos = []) {
  const total = atendimentos.length;
  const ativos = atendimentos.filter((item) => !!item?.ativo).length;

  return {
    total,
    ativos,
    inativos: Math.max(total - ativos, 0),
  };
}

function mapAtendimentoCard(item) {
  return {
    id: String(item?._id || ""),
    dataHoraIso: toIsoStringOrEmpty(item?.dataHora),
    tipoLabel: mapTipoAtendimentoLabel(item?.tipo),
    dataHoraLabel: toDateTimeLabel(item?.dataHora),
    diaLabel: mapDayLabel(item?.dataHora),
    dependenteNome: item?.pacienteId?.nome || "Nao informado",
    resumo: item?.resumo || "-",
    proximosPassos: item?.proximosPassos || "-",
    ativo: !!item?.ativo,
    statusLabel: item?.ativo ? "ATIVO" : "INATIVO",
  };
}

function buildCardsByMonth(cards = []) {
  const monthBuckets = new Map();

  cards.forEach((card) => {
    const dt = new Date(card.dataHoraIso || "");
    const monthKey = Number.isNaN(dt.getTime())
      ? "indefinido"
      : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;

    if (!monthBuckets.has(monthKey)) {
      monthBuckets.set(monthKey, {
        key: monthKey,
        label: mapMonthLabel(card.dataHoraIso),
        cards: [],
      });
    }

    monthBuckets.get(monthKey).cards.push(card);
  });

  return Array.from(monthBuckets.values())
    .map((bucket) => ({
      ...bucket,
      cards: [...bucket.cards].sort((a, b) => String(a.dataHoraIso).localeCompare(String(b.dataHoraIso))),
    }))
    .sort((a, b) => String(b.key).localeCompare(String(a.key)));
}

async function loadPortalFamilyData(usuario, query = {}) {
  const filtros = buildFamilyFilters(query);
  const isFamilia = String(usuario?.tipoCadastro || "").toLowerCase() === "familia";

  let familia = null;
  let cards = [];
  let cardsPorMes = [];
  let proximosAgendamentos = [];
  let historicoAgendamentos = [];
  let totais = {
    total: 0,
    ativos: 0,
    inativos: 0,
  };

  if (isFamilia) {
    familia = await findLinkedFamily(usuario);

    if (familia?._id) {
      const filtroAtendimento = await buildAtendimentoFilter(familia._id, filtros);
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);

      const [atendimentos, agendaFutura, agendaHistorico] = await Promise.all([
        Atendimento.find(filtroAtendimento)
          .populate("pacienteId", "_id nome")
          .sort({ dataHora: -1 })
          .limit(filtros.limit)
          .lean(),
        AgendaEvento.find({
          familiaId: familia._id,
          ativo: true,
          inicio: { $gte: inicioHoje },
          statusAgendamento: { $ne: "cancelado" },
        })
          .populate("responsavelId", "_id nome")
          .populate("salaId", "_id nome")
          .sort({ inicio: 1 })
          .limit(USER_AGENDA_LIMIT)
          .lean(),
        AgendaEvento.find({
          familiaId: familia._id,
          $or: [
            { inicio: { $lt: inicioHoje } },
            { statusPresenca: { $ne: "pendente" } },
            { statusAgendamento: { $in: ["cancelado", "encerrado", "remarcado"] } },
          ],
        })
          .populate("responsavelId", "_id nome")
          .populate("salaId", "_id nome")
          .sort({ inicio: -1 })
          .limit(USER_AGENDA_LIMIT)
          .lean(),
      ]);

      totais = buildTotals(atendimentos);
      cards = atendimentos.map(mapAtendimentoCard);
      cardsPorMes = buildCardsByMonth(cards);
      proximosAgendamentos = agendaFutura.map(mapAgendaCard);
      historicoAgendamentos = agendaHistorico.map(mapAgendaCard);
    }
  }

  return {
    usuario,
    tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
    isFamilia,
    familia,
    cards,
    cardsPorMes,
    proximosAgendamentos,
    historicoAgendamentos,
    totais,
    filtros,
  };
}

module.exports = {
  findLinkedFamily,
  loadPortalFamilyData,
};
