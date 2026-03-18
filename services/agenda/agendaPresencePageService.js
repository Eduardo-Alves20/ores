const mongoose = require("mongoose");

const Usuario = require("../../schemas/core/Usuario");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../accessControlService");
const {
  buildAssistidoRows,
  buildBasePresenceQuery,
  buildOccurrenceRows,
  buildPresenceCounters,
  buildProfissionalRows,
  buildWeeklyRows,
  getMonthRange,
  matchesPresenceFilters,
  parseBooleanFlag,
  parseDateInput,
  parseMonthInput,
  parseNumericChoice,
  parsePresenceStatusFilter,
  parseSelectOption,
  sameMonth,
  toDateInputValue,
  toMonthInputValue,
} = require("./agendaPresenceMetricsService");

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

function buildDetailSections(context) {
  const weeklyRows = buildWeeklyRows(context.filteredEvents);
  const assistidoRows = buildAssistidoRows(context.filteredEvents);
  const profissionalRows = buildProfissionalRows(context.filteredEvents);
  const occurrenceRows = buildOccurrenceRows(context.filteredEvents).filter((item) =>
    ["falta", "falta_justificada", "cancelado_antecipadamente"].includes(item.statusPresenca)
  );

  const suffix = context.baseQuery ? `?${context.baseQuery}` : "";

  return [
    {
      key: "semanas",
      label: "Semanas",
      count: weeklyRows.length,
      href: `/agenda/presencas/analise/semanas${suffix}`,
    },
    {
      key: "assistidos",
      label: "Assistidos",
      count: assistidoRows.length,
      href: `/agenda/presencas/analise/assistidos${suffix}`,
    },
    {
      key: "profissionais",
      label: context.canViewAll ? "Profissionais" : "Minha agenda",
      count: profissionalRows.length,
      href: `/agenda/presencas/analise/profissionais${suffix}`,
    },
    {
      key: "ocorrencias",
      label: "Ocorrencias",
      count: occurrenceRows.length,
      href: `/agenda/presencas/analise/ocorrencias${suffix}`,
    },
  ];
}

function buildPresenceDetailView(sectionKey, context, req) {
  const section = parseSelectOption(sectionKey, ["semanas", "assistidos", "profissionais", "ocorrencias"], "semanas");

  if (section === "semanas") {
    const focus = parseSelectOption(req.query?.focoSemanal, ["faltas", "comparecimento", "justificadas", "volume"], "faltas");
    const minEventos = parseNumericChoice(req.query?.minEventosSemanal, [1, 2, 3, 5], 1);
    const somenteSemanasCriticas = parseBooleanFlag(req.query?.somenteSemanasCriticas);

    let rows = buildWeeklyRows(context.filteredEvents).filter((item) => Number(item.total || 0) >= minEventos);
    if (somenteSemanasCriticas) {
      rows = rows.filter((item) => Number(item.totalAusencias || 0) > 0);
    }

    rows.sort((a, b) => {
      if (focus === "comparecimento") {
        if (b.taxaComparecimento !== a.taxaComparecimento) return b.taxaComparecimento - a.taxaComparecimento;
        return b.total - a.total;
      }
      if (focus === "justificadas") {
        if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
        return b.total - a.total;
      }
      if (focus === "volume") {
        if (b.total !== a.total) return b.total - a.total;
        return b.totalAusencias - a.totalAusencias;
      }
      if (b.totalAusencias !== a.totalAusencias) return b.totalAusencias - a.totalAusencias;
      return b.total - a.total;
    });

    const melhorSemana = rows.slice().sort((a, b) => b.taxaComparecimento - a.taxaComparecimento)[0] || null;
    const piorSemana = rows.slice().sort((a, b) => b.totalAusencias - a.totalAusencias)[0] || null;

    return {
      key: section,
      title: "Evolucao semanal da presenca",
      subtitle: "Entenda rapidamente quais semanas concentraram mais faltas, onde o comparecimento foi melhor e quais periodos merecem acompanhamento.",
      backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
      sectionNav: buildDetailSections(context),
      summaryCards: [
        {
          label: "Semanas analisadas",
          value: rows.length,
          meta: "Recortes semanais com agenda no periodo atual.",
          tone: "neutral",
        },
        {
          label: "Melhor comparecimento",
          value: melhorSemana?.label || "Sem dados",
          meta: melhorSemana ? `${melhorSemana.taxaComparecimento}% de presenca` : "Sem agenda suficiente para comparar.",
          tone: "success",
        },
        {
          label: "Semana mais critica",
          value: piorSemana?.label || "Sem dados",
          meta: piorSemana ? `${piorSemana.totalAusencias} ausencia(s) no recorte` : "Nenhuma ausencia registrada.",
          tone: "danger",
        },
        {
          label: "Justificativas no periodo",
          value: context.counters.justificadas || context.counters.faltaJustificada || 0,
          meta: "Ajuda a separar ausencia avisada de falta sem retorno.",
          tone: "warning",
        },
      ],
      filters: {
        focus,
        minEventos,
        somenteSemanasCriticas,
      },
      rows,
    };
  }

  if (section === "assistidos") {
    const ordenar = parseSelectOption(
      req.query?.ordenarAssistidos,
      ["faltas", "justificadas", "taxa_ausencia", "volume", "sequencia"],
      "faltas"
    );
    const minEventos = parseNumericChoice(req.query?.minEventosAssistidos, [1, 2, 3, 5, 8], 1);
    const somenteComAusencia = parseBooleanFlag(req.query?.somenteComAusenciaAssistidos);

    let rows = buildAssistidoRows(context.filteredEvents).filter((item) => Number(item.total || 0) >= minEventos);
    if (somenteComAusencia) {
      rows = rows.filter((item) => Number(item.totalAusencias || 0) > 0);
    }

    rows.sort((a, b) => {
      if (ordenar === "justificadas") {
        if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
        return b.total - a.total;
      }
      if (ordenar === "taxa_ausencia") {
        if (b.taxaAusencia !== a.taxaAusencia) return b.taxaAusencia - a.taxaAusencia;
        return b.total - a.total;
      }
      if (ordenar === "volume") {
        if (b.total !== a.total) return b.total - a.total;
        return b.totalAusencias - a.totalAusencias;
      }
      if (ordenar === "sequencia") {
        if (b.sequenciaAusencias !== a.sequenciaAusencias) return b.sequenciaAusencias - a.sequenciaAusencias;
        return b.totalAusencias - a.totalAusencias;
      }
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });

    const topFaltas = rows[0] || null;
    const topTaxa = rows.slice().sort((a, b) => b.taxaAusencia - a.taxaAusencia)[0] || null;
    const topSequencia = rows.slice().sort((a, b) => b.sequenciaAusencias - a.sequenciaAusencias)[0] || null;

    return {
      key: section,
      title: "Assistidos com mais ausencias",
      subtitle: "Use esta visao para identificar recorrencia, taxa de ausencia e quem esta precisando de contato mais rapido da equipe.",
      backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
      sectionNav: buildDetailSections(context),
      summaryCards: [
        {
          label: "Maior volume de faltas",
          value: topFaltas?.nome || "Sem dados",
          meta: topFaltas ? `${topFaltas.faltas} falta(s) e ${topFaltas.justificadas} justificativa(s)` : "Nenhuma ausencia encontrada.",
          tone: "danger",
        },
        {
          label: "Maior taxa de ausencia",
          value: topTaxa?.nome || "Sem dados",
          meta: topTaxa ? `${topTaxa.taxaAusencia}% de ausencia em ${topTaxa.total} agenda(s)` : "Aguardando historico suficiente.",
          tone: "warning",
        },
        {
          label: "Reincidencia atual",
          value: topSequencia?.nome || "Sem dados",
          meta: topSequencia ? `${topSequencia.sequenciaAusencias} ausencia(s) consecutiva(s)` : "Nenhuma sequencia aberta no periodo.",
          tone: "neutral",
        },
        {
          label: "Assistidos com ausencia",
          value: rows.filter((item) => Number(item.totalAusencias || 0) > 0).length,
          meta: "Recorte util para acao ativa da equipe social ou do responsavel.",
          tone: "info",
        },
      ],
      filters: {
        ordenar,
        minEventos,
        somenteComAusencia,
      },
      rows,
    };
  }

  if (section === "profissionais") {
    const ordenar = parseSelectOption(
      req.query?.ordenarProfissionais,
      ["faltas", "justificadas", "taxa_comparecimento", "volume"],
      "faltas"
    );
    const minEventos = parseNumericChoice(req.query?.minEventosProfissionais, [1, 2, 3, 5, 8], 1);
    const somenteComAusencia = parseBooleanFlag(req.query?.somenteComAusenciaProfissionais);

    let rows = buildProfissionalRows(context.filteredEvents).filter((item) => Number(item.total || 0) >= minEventos);
    if (somenteComAusencia) {
      rows = rows.filter((item) => Number(item.totalAusencias || 0) > 0);
    }

    rows.sort((a, b) => {
      if (ordenar === "justificadas") {
        if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
        return b.total - a.total;
      }
      if (ordenar === "taxa_comparecimento") {
        if (b.taxaComparecimento !== a.taxaComparecimento) return b.taxaComparecimento - a.taxaComparecimento;
        return b.total - a.total;
      }
      if (ordenar === "volume") {
        if (b.total !== a.total) return b.total - a.total;
        return b.totalAusencias - a.totalAusencias;
      }
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });

    const topVolume = rows.slice().sort((a, b) => b.total - a.total)[0] || null;
    const topComparecimento = rows.slice().sort((a, b) => b.taxaComparecimento - a.taxaComparecimento)[0] || null;
    const topAusencias = rows[0] || null;

    return {
      key: section,
      title: context.canViewAll ? "Visao dos profissionais" : "Minha agenda no periodo",
      subtitle: context.canViewAll
        ? "Compare volume, faltas e taxa de comparecimento por responsavel para ajustar distribuicao e acompanhamento."
        : "Veja seu proprio desempenho no periodo e quais assistidos mais concentraram faltas na sua agenda.",
      backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
      sectionNav: buildDetailSections(context),
      summaryCards: [
        {
          label: "Maior volume",
          value: topVolume?.nome || "Sem dados",
          meta: topVolume ? `${topVolume.total} agenda(s) no periodo` : "Nenhum profissional com agenda no recorte.",
          tone: "neutral",
        },
        {
          label: "Melhor comparecimento",
          value: topComparecimento?.nome || "Sem dados",
          meta: topComparecimento ? `${topComparecimento.taxaComparecimento}% de presenca` : "Sem base suficiente no periodo.",
          tone: "success",
        },
        {
          label: "Mais ausencias",
          value: topAusencias?.nome || "Sem dados",
          meta: topAusencias ? `${topAusencias.totalAusencias} ausencia(s) no recorte` : "Nenhuma ausencia registrada.",
          tone: "danger",
        },
        {
          label: "Profissionais analisados",
          value: rows.length,
          meta: context.canViewAll ? "Apenas quem teve agenda dentro do periodo atual." : "Sua agenda consolidada no recorte.",
          tone: "info",
        },
      ],
      filters: {
        ordenar,
        minEventos,
        somenteComAusencia,
      },
      rows,
    };
  }

  const tipoOcorrencia = parseSelectOption(
    req.query?.tipoOcorrencia,
    ["todos", "falta", "falta_justificada", "cancelado_antecipadamente"],
    "todos"
  );
  const somenteComObservacao = parseBooleanFlag(req.query?.somenteComObservacaoOcorrencias);
  const limite = parseNumericChoice(req.query?.limiteOcorrencias, [20, 50, 100], 20);

  let rows = buildOccurrenceRows(context.filteredEvents).filter((item) =>
    ["falta", "falta_justificada", "cancelado_antecipadamente"].includes(item.statusPresenca)
  );

  if (tipoOcorrencia !== "todos") {
    rows = rows.filter((item) => item.statusPresenca === tipoOcorrencia);
  }
  if (somenteComObservacao) {
    rows = rows.filter((item) => item.hasObservacao);
  }
  rows = rows.slice(0, limite);

  return {
    key: "ocorrencias",
    title: "Ocorrencias recentes de ausencia",
    subtitle: "Centralize faltas, justificativas e cancelamentos para encontrar rapidamente o que precisa de retorno, registro ou remarcacao.",
    backHref: context.baseQuery ? `/agenda/presencas?${context.baseQuery}` : "/agenda/presencas",
    sectionNav: buildDetailSections(context),
    summaryCards: [
      {
        label: "Faltas abertas",
        value: context.counters.falta || 0,
        meta: "Ausencias sem justificativa dentro do recorte atual.",
        tone: "danger",
      },
      {
        label: "Justificadas",
        value: context.counters.faltaJustificada || 0,
        meta: "Faltas com contexto registrado na ficha.",
        tone: "warning",
      },
      {
        label: "Canceladas antecipadamente",
        value: context.counters.cancelado || 0,
        meta: "Compromissos cancelados antes do fechamento final.",
        tone: "neutral",
      },
      {
        label: "Ocorrencia mais recente",
        value: rows[0]?.pacienteNome || "Sem dados",
        meta: rows[0] ? `${rows[0].statusPresencaLabel} em ${rows[0].dataHoraLabel}` : "Nenhuma ocorrencia recente.",
        tone: "info",
      },
    ],
    filters: {
      tipoOcorrencia,
      somenteComObservacao,
      limite,
    },
    rows,
  };
}

module.exports = {
  loadPresenceContext,
  buildPresenceDetailView,
};
