const mongoose = require("mongoose");

const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento } = require("../../schemas/social/Atendimento");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const Usuario = require("../../schemas/core/Usuario");
const AuditTrail = require("../../schemas/core/AuditTrail");
const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../shared/accessControlService");
const { asObjectId, resolveScopedFamilyIds } = require("../shared/volunteerScopeService");
const {
  buildBirthdayWindowLabel,
  getBirthdayCampaignForDashboard,
} = require("../shared/systemConfigService");

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const SHORT_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

const STATUS_VISUALS = Object.freeze({
  presente: {
    label: "Presente",
    color: "#16a34a",
  },
  falta: {
    label: "Falta",
    color: "#ef4444",
  },
  falta_justificada: {
    label: "Falta justificada",
    color: "#f59e0b",
  },
  pendente: {
    label: "Pendente",
    color: "#3b82f6",
  },
  cancelado_antecipadamente: {
    label: "Cancelado",
    color: "#94a3b8",
  },
});

function toMonthStart(dateLike, shiftMonths = 0) {
  const base = new Date(dateLike);
  return new Date(base.getFullYear(), base.getMonth() + shiftMonths, 1, 0, 0, 0, 0);
}

function toMonthEndExclusive(dateLike, shiftMonths = 0) {
  const base = new Date(dateLike);
  return new Date(base.getFullYear(), base.getMonth() + shiftMonths + 1, 1, 0, 0, 0, 0);
}

function toComparableMonthRange(dateLike, shiftMonths = 0) {
  const base = new Date(dateLike);
  const start = toMonthStart(base, shiftMonths);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + shiftMonths + 1, 0, 23, 59, 59, 999);
  const maxDay = monthEnd.getDate();
  const targetDay = Math.min(base.getDate(), maxDay);
  const end = new Date(start.getFullYear(), start.getMonth(), targetDay, 23, 59, 59, 999);
  return { start, end };
}

function toFullMonthRange(dateLike, shiftMonths = 0) {
  const start = toMonthStart(dateLike, shiftMonths);
  const end = new Date(toMonthEndExclusive(dateLike, shiftMonths).getTime() - 1);
  return { start, end };
}

function toDayRange(dateLike, shiftDays = 0) {
  const base = new Date(dateLike);
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + shiftDays, 0, 0, 0, 0);
  const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + shiftDays + 1, 0, 0, 0, 0);
  return { start, end };
}

function toRollingRange(dateLike, days, endShiftDays = 0) {
  const end = new Date(dateLike);
  end.setDate(end.getDate() + endShiftDays);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(Number(days || 0) - 1, 0));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function clampPercentage(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Math.round(numeric);
}

function toLocaleNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function toShortDateLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return SHORT_DATE_FORMATTER.format(date);
}

function toLongDateLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return LONG_DATE_FORMATTER.format(date);
}

function toMonthLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  const raw = MONTH_LABEL_FORMATTER.format(date).replace(".", "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function toPercent(value, total) {
  if (!Number(total)) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
}

function toStartOfDay(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function toInitials(value, fallback = "GS") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return fallback;

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function toUserTypeLabel(tipoCadastro) {
  const value = String(tipoCadastro || "").trim().toLowerCase();
  if (value === "familia") return "Família";
  if (value === "orgao_publico") return "Órgão Público";
  return "Voluntário";
}

function buildBirthdayOccurrence(referenceDate, birthdayDate) {
  const reference = toStartOfDay(referenceDate);
  const birthday = new Date(birthdayDate);
  if (!reference || Number.isNaN(birthday.getTime())) return null;

  const buildForYear = (year) => {
    const lastDay = new Date(year, birthday.getMonth() + 1, 0).getDate();
    return new Date(
      year,
      birthday.getMonth(),
      Math.min(birthday.getDate(), lastDay),
      12,
      0,
      0,
      0
    );
  };

  let occurrence = buildForYear(reference.getFullYear());
  if (occurrence < reference) {
    occurrence = buildForYear(reference.getFullYear() + 1);
  }

  return occurrence;
}

function buildBirthdayItems(users = [], referenceDate = new Date(), maxDaysAhead = 7) {
  const reference = toStartOfDay(referenceDate);
  if (!reference) return [];

  return (Array.isArray(users) ? users : [])
    .map((item) => {
      const occurrence = buildBirthdayOccurrence(reference, item?.dataNascimento);
      if (!occurrence) return null;

      const diffDays = Math.round((occurrence.getTime() - reference.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays < 0 || diffDays > maxDaysAhead) return null;

      return {
        nome: String(item?.nome || "").trim() || "Aniversariante",
        initials: toInitials(item?.nome, "AN"),
        tipo: String(item?.tipoCadastro || "voluntario").trim().toLowerCase(),
        tipoLabel: toUserTypeLabel(item?.tipoCadastro),
        dataLabel: SHORT_DAY_MONTH_FORMATTER.format(occurrence),
        dayLabel:
          diffDays === 0 ? "Hoje" : diffDays === 1 ? "Amanhã" : `Em ${diffDays} dias`,
        isToday: diffDays === 0,
        diffDays,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.diffDays !== right.diffDays) return left.diffDays - right.diffDays;
      return String(left.nome || "").localeCompare(String(right.nome || ""), "pt-BR");
    })
    .slice(0, 8);
}

function buildTrend(current, previous, options = {}) {
  const {
    suffix = "vs período anterior",
    positiveWhen = "up",
    precision = 1,
    neutralLabel = "Sem base comparativa suficiente.",
  } = options;

  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);

  if (previousValue === 0) {
    if (currentValue === 0) {
      return {
        direction: "flat",
        tone: "neutral",
        label: neutralLabel,
      };
    }

    return {
      direction: "up",
      tone: positiveWhen === "up" ? "positive" : "negative",
      label: `Novo movimento ${suffix}`,
    };
  }

  const delta = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Number(delta.toFixed(precision));
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const tone =
    direction === "flat"
      ? "neutral"
      : direction === positiveWhen
        ? "positive"
        : "negative";

  return {
    direction,
    tone,
    label: `${rounded > 0 ? "+" : ""}${rounded.toFixed(precision)}% ${suffix}`,
  };
}

function buildCard(options) {
  return {
    key: options.key,
    icon: options.icon,
    title: options.title,
    value: options.value,
    caption: options.caption,
    trend: options.trend || null,
    progress: options.progress || null,
    href: options.href || "",
  };
}

function buildMetricVisual(value, label, color) {
  return {
    value: Number(value || 0),
    label,
    color,
  };
}

function buildDonutModel(statusRows = []) {
  const items = statusRows.filter((item) => Number(item?.value || 0) > 0);
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  if (!total) {
    return {
      total: 0,
      gradient: "conic-gradient(#dbe4f0 0 100%)",
      items: [],
    };
  }

  let cursor = 0;
  const normalizedItems = items.map((item) => {
    const share = (Number(item.value || 0) / total) * 100;
    const start = cursor;
    cursor += share;

    return {
      key: item.key,
      label: item.label,
      value: Number(item.value || 0),
      share: clampPercentage(share),
      color: item.color,
      start,
      end: cursor,
    };
  });

  return {
    total,
    gradient: `conic-gradient(${normalizedItems
      .map((item) => `${item.color} ${item.start}% ${item.end}%`)
      .join(", ")})`,
    items: normalizedItems,
  };
}

function buildScopeFilters(scopedFamilyObjectIds) {
  if (scopedFamilyObjectIds === null) {
    return {
      families: {},
      patients: {},
      atendimentos: {},
    };
  }

  if (!scopedFamilyObjectIds.length) {
    return {
      families: { _id: { $in: [] } },
      patients: { familiaId: { $in: [] } },
      atendimentos: { familiaId: { $in: [] } },
    };
  }

  return {
    families: { _id: { $in: scopedFamilyObjectIds } },
    patients: { familiaId: { $in: scopedFamilyObjectIds } },
    atendimentos: { familiaId: { $in: scopedFamilyObjectIds } },
  };
}

function buildAgendaScopeFilter(canViewAgenda, canViewAllAgenda, actorId) {
  if (!canViewAgenda) return null;
  if (canViewAllAgenda) return {};
  if (!actorId) return { _id: { $in: [] } };
  return { responsavelId: actorId };
}

function buildMonthlyBuckets(dateLike, count = 12) {
  const total = Math.max(Number(count || 0), 1);
  return Array.from({ length: total }, (_, index) => {
    const shift = index - (total - 1);
    const start = toMonthStart(dateLike, shift);
    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: toMonthLabel(start),
      start,
    };
  });
}

async function aggregateMonthlyCounts(model, fieldName, buckets, extraMatch = {}) {
  if (!Array.isArray(buckets) || !buckets.length) return [];

  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];
  const fieldPath = `$${fieldName}`;
  const rows = await model.aggregate([
    {
      $match: {
        ...extraMatch,
        [fieldName]: {
          $gte: new Date(firstBucket.start),
          $lt: toMonthEndExclusive(lastBucket.start, 0),
        },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: fieldPath },
          month: { $month: fieldPath },
        },
        total: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    rows.map((row) => [
      `${row?._id?.year}-${String(row?._id?.month || "").padStart(2, "0")}`,
      Number(row?.total || 0),
    ])
  );

  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: Number(countMap.get(bucket.key) || 0),
  }));
}

async function aggregateAgendaStatusCounts(baseMatch = {}) {
  const rows = await AgendaEvento.aggregate([
    {
      $match: baseMatch,
    },
    {
      $group: {
        _id: "$statusPresenca",
        total: { $sum: 1 },
      },
    },
  ]);

  return ["presente", "falta", "falta_justificada", "pendente", "cancelado_antecipadamente"].map((key) => {
    const current = rows.find((row) => String(row?._id || "pendente") === key);
    const visual = STATUS_VISUALS[key];
    return {
      key,
      ...buildMetricVisual(current?.total || 0, visual.label, visual.color),
    };
  });
}

async function aggregateTopResponsaveis(baseMatch = {}, limit = 5) {
  const rows = await AgendaEvento.aggregate([
    {
      $match: baseMatch,
    },
    {
      $group: {
        _id: "$responsavelId",
        total: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
    { $limit: limit },
  ]);

  const ids = rows
    .map((row) => row?._id)
    .filter((value) => value instanceof mongoose.Types.ObjectId || mongoose.Types.ObjectId.isValid(String(value || "")));

  const users = ids.length
    ? await Usuario.find({ _id: { $in: ids } }).select("_id nome").lean()
    : [];

  const userMap = new Map(users.map((item) => [String(item._id), item]));
  const max = rows[0]?.total || 0;

  return rows.map((row) => {
    const user = userMap.get(String(row?._id || ""));
    const total = Number(row?.total || 0);
    return {
      id: String(row?._id || ""),
      label: user?.nome || "Equipe sem nome",
      initials: toInitials(user?.nome, "EQ"),
      value: total,
      share: max > 0 ? Math.round((total / max) * 100) : 0,
      hint: `${toLocaleNumber(total)} agendamento(s) nos últimos 30 dias`,
    };
  });
}

function buildHighlights(model = {}) {
  const items = [];

  if (Array.isArray(model.timelineSeries) && model.timelineSeries.length) {
    const busiest = model.timelineSeries.reduce((top, current) => {
      if (!top || Number(current.atendimentos || 0) > Number(top.atendimentos || 0)) return current;
      return top;
    }, null);

    if (busiest) {
      items.push({
        icon: "fa-solid fa-chart-line",
        title: "Mês mais intenso",
        value: busiest.label,
        description: `${toLocaleNumber(busiest.atendimentos)} atendimento(s) registrados no período.`,
      });
    }
  }

  if (Array.isArray(model.teamLoad) && model.teamLoad.length) {
    const lead = model.teamLoad[0];
    items.push({
      icon: "fa-solid fa-user-tie",
      title: "Maior carga da equipe",
      value: lead.label,
      description: `${toLocaleNumber(lead.value)} agendamento(s) concentrados nos últimos 30 dias.`,
    });
  }

  if (Array.isArray(model.distribution?.items) && model.distribution.items.length) {
    const dominant = model.distribution.items[0];
    items.push({
      icon: "fa-solid fa-bullseye",
      title: "Status predominante",
      value: dominant.label,
      description: `${dominant.share}% da agenda do mês está nessa faixa.`,
    });
  }

  return items.slice(0, 3);
}

function buildAlertItem(options) {
  return {
    icon: options.icon,
    tone: options.tone || "neutral",
    value: options.value,
    label: options.label,
    description: options.description,
    href: options.href || "",
  };
}

function buildQuickAction(options) {
  return {
    icon: options.icon,
    label: options.label,
    description: options.description,
    href: options.href,
    badge: options.badge || "",
  };
}

async function buildDashboardViewModel(req) {
  const now = new Date();
  const user = req?.session?.user || null;
  const permissionList = Array.isArray(user?.permissions) ? user.permissions : [];
  const actorId = asObjectId(user?.id);
  const normalizedProfile = String(user?.perfil || "").trim().toLowerCase();

  const canViewFamilies = hasAnyPermission(permissionList, [PERMISSIONS.FAMILIAS_VIEW]);
  const canCreateFamilies = hasAnyPermission(permissionList, [PERMISSIONS.FAMILIAS_CREATE]);
  const canViewAgenda = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_VIEW]);
  const canViewAllAgenda = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const canApproveAccess =
    normalizedProfile === PERFIS.SUPERADMIN ||
    hasAnyPermission(permissionList, [PERMISSIONS.ACESSOS_APPROVE]);
  const canViewNotifications = hasAnyPermission(permissionList, [PERMISSIONS.NOTIFICACOES_VIEW]);
  const canUseGlobalSearch = hasAnyPermission(permissionList, [PERMISSIONS.BUSCA_GLOBAL]);
  const canManageAdministration =
    normalizedProfile === PERFIS.ADMIN || normalizedProfile === PERFIS.SUPERADMIN;

  const scopedFamilyIds = await resolveScopedFamilyIds(user);
  const scopedFamilyObjectIds =
    scopedFamilyIds === null
      ? null
      : scopedFamilyIds.map((id) => asObjectId(id)).filter(Boolean);

  const scopedFilters = buildScopeFilters(scopedFamilyObjectIds);
  const agendaScopeFilter = buildAgendaScopeFilter(canViewAgenda, canViewAllAgenda, actorId);

  const monthCurrentComparable = toComparableMonthRange(now, 0);
  const monthPreviousComparable = toComparableMonthRange(now, -1);
  const monthCurrentFull = toFullMonthRange(now, 0);
  const todayRange = toDayRange(now, 0);
  const nextWeekRange = {
    start: todayRange.start,
    end: new Date(todayRange.start.getFullYear(), todayRange.start.getMonth(), todayRange.start.getDate() + 7, 23, 59, 59, 999),
  };
  const rolling30 = toRollingRange(now, 30);
  const previousRolling30 = {
    start: new Date(rolling30.start.getFullYear(), rolling30.start.getMonth(), rolling30.start.getDate() - 30, 0, 0, 0, 0),
    end: new Date(rolling30.start.getFullYear(), rolling30.start.getMonth(), rolling30.start.getDate() - 1, 23, 59, 59, 999),
  };
  const last7Days = toRollingRange(now, 7);
  const timelineBuckets = buildMonthlyBuckets(now, 12);

  const pendingAgendaBase = agendaScopeFilter
    ? {
        ...agendaScopeFilter,
        ativo: true,
        statusPresenca: "pendente",
        statusAgendamento: { $nin: ["cancelado"] },
      }
    : null;

  const attendanceRateCurrentMatch = agendaScopeFilter
    ? {
        ...agendaScopeFilter,
        ativo: true,
        inicio: { $gte: rolling30.start, $lte: rolling30.end },
        statusPresenca: { $in: ["presente", "falta", "falta_justificada", "cancelado_antecipadamente"] },
      }
    : null;

  const attendanceRatePreviousMatch = agendaScopeFilter
    ? {
        ...agendaScopeFilter,
        ativo: true,
        inicio: { $gte: previousRolling30.start, $lte: previousRolling30.end },
        statusPresenca: { $in: ["presente", "falta", "falta_justificada", "cancelado_antecipadamente"] },
      }
    : null;

  const historicalActivePacienteFilter = {
    ...scopedFilters.patients,
    createdAt: { $lt: monthCurrentComparable.start },
    $or: [{ inativadoEm: null }, { inativadoEm: { $gte: monthCurrentComparable.start } }],
  };

  const [
    totalDependentesAtivos,
    totalDependentesMesAnteriorAtivos,
    totalFamiliasAtivas,
    cadastrosMesAtual,
    cadastrosMesAnterior,
    atendimentosHoje,
    atendimentosMesAtual,
    agendaHojeTotal,
    agendaPendentesHoje,
    agendaPendentesSemana,
    pendingApprovalCount,
    recentFailuresCount,
    recentAbsencesCount,
    birthdayCampaign,
    birthdayUsers,
    currentAttendanceDocs,
    previousAttendanceDocs,
    cadastrosSeries,
    atendimentosSeries,
    agendaStatusMonth,
    teamLoad,
    familiasRecentes,
  ] = await Promise.all([
    Paciente.countDocuments({ ...scopedFilters.patients, ativo: true }),
    Paciente.countDocuments(historicalActivePacienteFilter),
    Familia.countDocuments({ ...scopedFilters.families, ativo: true }),
    Familia.countDocuments({
      ...scopedFilters.families,
      createdAt: { $gte: monthCurrentComparable.start, $lte: monthCurrentComparable.end },
    }),
    Familia.countDocuments({
      ...scopedFilters.families,
      createdAt: { $gte: monthPreviousComparable.start, $lte: monthPreviousComparable.end },
    }),
    Atendimento.countDocuments({
      ...scopedFilters.atendimentos,
      ativo: true,
      dataHora: { $gte: todayRange.start, $lt: todayRange.end },
    }),
    Atendimento.countDocuments({
      ...scopedFilters.atendimentos,
      ativo: true,
      dataHora: { $gte: monthCurrentComparable.start, $lte: monthCurrentComparable.end },
    }),
    agendaScopeFilter
      ? AgendaEvento.countDocuments({
          ...agendaScopeFilter,
          ativo: true,
          inicio: { $gte: todayRange.start, $lt: todayRange.end },
          statusAgendamento: { $nin: ["cancelado"] },
        })
      : Promise.resolve(0),
    pendingAgendaBase
      ? AgendaEvento.countDocuments({
          ...pendingAgendaBase,
          inicio: { $gte: todayRange.start, $lt: todayRange.end },
        })
      : Promise.resolve(0),
    pendingAgendaBase
      ? AgendaEvento.countDocuments({
          ...pendingAgendaBase,
          inicio: { $gte: nextWeekRange.start, $lte: nextWeekRange.end },
        })
      : Promise.resolve(0),
    canApproveAccess
      ? Usuario.countDocuments({
          perfil: PERFIS.USUARIO,
          statusAprovacao: "pendente",
        })
      : Promise.resolve(0),
    canViewNotifications
      ? AuditTrail.countDocuments({
          createdAt: { $gte: last7Days.start, $lte: last7Days.end },
          acao: /FALHA/i,
        })
      : Promise.resolve(0),
    agendaScopeFilter
      ? AgendaEvento.countDocuments({
          ...agendaScopeFilter,
          ativo: true,
          inicio: { $gte: last7Days.start, $lte: last7Days.end },
          statusPresenca: { $in: ["falta", "falta_justificada"] },
        })
      : Promise.resolve(0),
    getBirthdayCampaignForDashboard(),
    Usuario.find({
      perfil: PERFIS.USUARIO,
      ativo: true,
      tipoCadastro: { $in: ["familia", "voluntario", "orgao_publico"] },
      dataNascimento: { $ne: null },
      $or: [{ statusAprovacao: "aprovado" }, { statusAprovacao: { $exists: false } }],
    })
      .select("nome tipoCadastro dataNascimento")
      .lean(),
    attendanceRateCurrentMatch
      ? AgendaEvento.find(attendanceRateCurrentMatch).select("statusPresenca").lean()
      : Promise.resolve([]),
    attendanceRatePreviousMatch
      ? AgendaEvento.find(attendanceRatePreviousMatch).select("statusPresenca").lean()
      : Promise.resolve([]),
    aggregateMonthlyCounts(Familia, "createdAt", timelineBuckets, scopedFilters.families),
    aggregateMonthlyCounts(Atendimento, "dataHora", timelineBuckets, {
      ...scopedFilters.atendimentos,
      ativo: true,
    }),
    agendaScopeFilter
      ? aggregateAgendaStatusCounts({
          ...agendaScopeFilter,
          ativo: true,
          inicio: { $gte: monthCurrentFull.start, $lte: monthCurrentFull.end },
        })
      : Promise.resolve([]),
    agendaScopeFilter
      ? aggregateTopResponsaveis(
          {
            ...agendaScopeFilter,
            ativo: true,
            inicio: { $gte: rolling30.start, $lte: rolling30.end },
            statusAgendamento: { $nin: ["cancelado"] },
          },
          5
        )
      : Promise.resolve([]),
    canViewFamilies
      ? Familia.find(scopedFilters.families)
          .sort({ createdAt: -1 })
          .limit(8)
          .select("_id responsavel endereco createdAt ativo criadoPor")
          .populate("criadoPor", "nome")
          .lean()
      : Promise.resolve([]),
  ]);

  const attendanceCurrentTotal = Array.isArray(currentAttendanceDocs) ? currentAttendanceDocs.length : 0;
  const attendanceCurrentPresentes = (currentAttendanceDocs || []).filter(
    (item) => String(item?.statusPresenca || "") === "presente"
  ).length;
  const attendancePreviousTotal = Array.isArray(previousAttendanceDocs) ? previousAttendanceDocs.length : 0;
  const attendancePreviousPresentes = (previousAttendanceDocs || []).filter(
    (item) => String(item?.statusPresenca || "") === "presente"
  ).length;
  const attendanceRateCurrent = toPercent(attendanceCurrentPresentes, attendanceCurrentTotal);
  const attendanceRatePrevious = toPercent(attendancePreviousPresentes, attendancePreviousTotal);

  const atendimentoTarget = agendaHojeTotal > 0 ? agendaHojeTotal : Math.max(Math.ceil(atendimentosMesAtual / Math.max(now.getDate(), 1)), 1);
  const atendimentoProgress = clampPercentage((Number(atendimentosHoje || 0) / Math.max(Number(atendimentoTarget || 1), 1)) * 100);

  const summaryCards = [
    buildCard({
      key: "dependentes-ativos",
      icon: "fa-solid fa-people-group",
      title: "Dependentes ativos",
      value: toLocaleNumber(totalDependentesAtivos),
      caption: `${toLocaleNumber(totalFamiliasAtivas)} família(s) ativas na base`,
      trend: buildTrend(totalDependentesAtivos, totalDependentesMesAnteriorAtivos, {
        suffix: "desde o início do mês",
      }),
      href: canViewFamilies ? "/familias" : "",
    }),
    buildCard({
      key: "cadastros-mes",
      icon: "fa-solid fa-user-plus",
      title: "Novos cadastros no mês",
      value: toLocaleNumber(cadastrosMesAtual),
      caption: "Famílias adicionadas no recorte atual",
      trend: buildTrend(cadastrosMesAtual, cadastrosMesAnterior, {
        suffix: "vs mês anterior comparável",
      }),
      href: canViewFamilies ? "/familias" : "",
    }),
    buildCard({
      key: "atendimentos-hoje",
      icon: "fa-solid fa-calendar-check",
      title: "Atendimentos hoje",
      value: toLocaleNumber(atendimentosHoje),
      caption:
        agendaHojeTotal > 0
          ? `${toLocaleNumber(agendaHojeTotal)} compromisso(s) previstos para hoje`
          : "Ritmo comparado com a média diária do mês",
      progress: {
        value: atendimentoProgress,
        label:
          agendaHojeTotal > 0
            ? `${atendimentoProgress}% da agenda do dia já registrada`
            : `${atendimentoProgress}% da meta diária estimada`,
      },
      href: canViewAgenda ? "/agenda" : "",
    }),
    buildCard({
      key: "comparecimento",
      icon: "fa-solid fa-user-check",
      title: "Taxa de comparecimento",
      value: `${attendanceRateCurrent}%`,
      caption:
        attendanceCurrentTotal > 0
          ? `${toLocaleNumber(attendanceCurrentPresentes)} presença(s) em ${toLocaleNumber(attendanceCurrentTotal)} agenda(s) concluídas`
          : "Sem base suficiente nos últimos 30 dias",
      trend: buildTrend(attendanceRateCurrent, attendanceRatePrevious, {
        suffix: "vs 30 dias anteriores",
      }),
      href: canViewAgenda ? "/agenda/presencas" : "",
    }),
  ];

  const alertItems = []
    .concat(
      canApproveAccess
        ? [
            buildAlertItem({
              icon: "fa-solid fa-circle-check",
              tone: pendingApprovalCount > 0 ? "warning" : "success",
              value: toLocaleNumber(pendingApprovalCount),
              label: "Aprovações pendentes",
              description:
                pendingApprovalCount > 0
                  ? "Cadastros aguardando decisão da administração."
                  : "Nenhuma aprovação aguardando fila neste momento.",
              href: "/acessos/aprovacoes",
            }),
          ]
        : []
    )
    .concat(
      canViewAgenda
        ? [
            buildAlertItem({
              icon: "fa-solid fa-user-clock",
              tone: agendaPendentesHoje > 0 ? "danger" : "neutral",
              value: toLocaleNumber(agendaPendentesHoje),
              label: "Presenças para registrar hoje",
              description:
                agendaPendentesHoje > 0
                  ? `${toLocaleNumber(agendaPendentesSemana)} registro(s) pendente(s) na agenda dos próximos 7 dias.`
                  : "Rotina do dia sem registros atrasados na agenda.",
              href: "/agenda/presencas",
            }),
            buildAlertItem({
              icon: "fa-solid fa-triangle-exclamation",
              tone: recentAbsencesCount > 0 ? "danger" : "neutral",
              value: toLocaleNumber(recentAbsencesCount),
              label: "Ausências recentes",
              description:
                recentAbsencesCount > 0
                  ? "Faltas e justificativas registradas nos últimos 7 dias."
                  : "Nenhuma ausência recente exigindo retorno imediato.",
              href: "/agenda/presencas/analise/ocorrencias",
            }),
          ]
        : []
    )
    .concat(
      canViewNotifications
        ? [
            buildAlertItem({
              icon: "fa-solid fa-bell",
              tone: recentFailuresCount > 0 ? "warning" : "neutral",
              value: toLocaleNumber(recentFailuresCount),
              label: "Alertas do sistema",
              description:
                recentFailuresCount > 0
                  ? "Falhas operacionais registradas nos últimos 7 dias."
                  : "Sem falhas operacionais recentes no monitoramento.",
              href: "/notificacoes",
            }),
          ]
        : []
    );

  if (!alertItems.length) {
    alertItems.push(
      buildAlertItem({
        icon: "fa-solid fa-circle-check",
        tone: "neutral",
        value: "0",
        label: "Sem pendências críticas",
        description: "Não há blocos prioritários disponíveis para o seu perfil neste momento.",
        href: "",
      })
    );
  }

  const quickActions = [
    canViewFamilies
      ? buildQuickAction({
          icon: "fa-solid fa-people-group",
          label: "Assistidos",
          description: "Abrir base social e localizar famílias rapidamente.",
          href: "/familias",
        })
      : null,
    canCreateFamilies
      ? buildQuickAction({
          icon: "fa-solid fa-user-plus",
          label: "Nova família",
          description: "Cadastrar um novo núcleo assistido.",
          href: "/familias/nova",
        })
      : null,
    canViewAgenda
      ? buildQuickAction({
          icon: "fa-solid fa-calendar-days",
          label: "Agenda",
          description: "Acompanhar compromissos, salas e responsáveis.",
          href: "/agenda",
        })
      : null,
    canViewAgenda
      ? buildQuickAction({
          icon: "fa-solid fa-user-check",
          label: "Presenças",
          description: "Conferir comparecimento e registrar ausências.",
          href: "/agenda/presencas",
        })
      : null,
    canApproveAccess
      ? buildQuickAction({
          icon: "fa-solid fa-badge-check",
          label: "Aprovações",
          description: "Revisar novos acessos ao sistema.",
          href: "/acessos/aprovacoes",
          badge: pendingApprovalCount > 0 ? toLocaleNumber(pendingApprovalCount) : "",
        })
      : null,
  ].filter(Boolean);

  const birthdayAudience =
    Array.isArray(birthdayCampaign?.publico) && birthdayCampaign.publico.length
      ? birthdayCampaign.publico
      : ["familia", "voluntario", "orgao_publico"];
  const birthdayDaysAhead = Number.isFinite(Number(birthdayCampaign?.diasAntecedencia))
    ? Number(birthdayCampaign.diasAntecedencia)
    : 7;
  const filteredBirthdayUsers = (Array.isArray(birthdayUsers) ? birthdayUsers : []).filter((item) =>
    birthdayAudience.includes(String(item?.tipoCadastro || "").trim().toLowerCase())
  );
  const birthdayItems = buildBirthdayItems(filteredBirthdayUsers, now, birthdayDaysAhead);
  const birthdayWidget = {
    title: birthdayCampaign?.nome || "Aniversariantes",
    subtitle: "Hoje e próximos 7 dias",
    items: birthdayItems,
    emptyMessage: "Nenhum aniversariante no período.",
  };
  birthdayWidget.subtitle =
    birthdayCampaign?.janelaLabel || buildBirthdayWindowLabel(birthdayDaysAhead);
  birthdayWidget.description =
    birthdayCampaign?.descricao ||
    "Lista ativa de aniversariantes para orientar a equipe no acompanhamento da semana.";
  birthdayWidget.emptyMessage =
    birthdayCampaign?.status === "ativa"
      ? "Nenhum aniversariante no periodo da campanha."
      : "Nenhum aniversariante no periodo.";
  birthdayWidget.href = canManageAdministration ? "/administracao#campanhas-aniversario" : "";
  birthdayWidget.actionLabel = canManageAdministration ? "Gerenciar campanha" : "";

  const distributionRows = agendaStatusMonth
    .map((item) => ({
      key: item.key,
      label: item.label,
      value: item.value,
      color: item.color,
    }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));

  const distribution = buildDonutModel(distributionRows);

  const timelineSeries = timelineBuckets.map((bucket, index) => ({
    key: bucket.key,
    label: bucket.label,
    cadastros: Number(cadastrosSeries[index]?.value || 0),
    atendimentos: Number(atendimentosSeries[index]?.value || 0),
  }));

  const recentFamilyIds = familiasRecentes.map((item) => item?._id).filter(Boolean);
  const patientCountRows = recentFamilyIds.length
    ? await Paciente.aggregate([
        {
          $match: {
            familiaId: { $in: recentFamilyIds },
          },
        },
        {
          $group: {
            _id: "$familiaId",
            total: { $sum: 1 },
            ativos: {
              $sum: {
                $cond: [{ $eq: ["$ativo", true] }, 1, 0],
              },
            },
          },
        },
      ])
    : [];

  const patientCountMap = new Map(patientCountRows.map((item) => [String(item?._id || ""), item]));

  const recentRows = familiasRecentes.map((item) => {
    const patientStats = patientCountMap.get(String(item?._id || "")) || { total: 0, ativos: 0 };
    const responsavelCadastro = item?.criadoPor?.nome || "Equipe";
    const familyName = String(item?.responsavel?.nome || "Sem nome");

    return {
      id: String(item?._id || ""),
      nome: familyName,
      initials: toInitials(familyName, "FA"),
      status: item?.ativo ? "Ativo" : "Inativo",
      statusTone: item?.ativo ? "active" : "inactive",
      cidade: item?.endereco?.cidade || "Cidade não informada",
      telefone: item?.responsavel?.telefone || "-",
      data: toShortDateLabel(item?.createdAt),
      dependentes: Number(patientStats.total || 0),
      dependentesAtivos: Number(patientStats.ativos || 0),
      responsavelCadastro,
      responsavelCadastroInitials: toInitials(responsavelCadastro, "EQ"),
      href: `/familias/${String(item?._id || "")}`,
    };
  });

  const totalCritical = pendingApprovalCount + agendaPendentesHoje + recentAbsencesCount + recentFailuresCount;
  const firstName = String(user?.nome || "Equipe")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || "Equipe";
  const currentHour = now.getHours();
  const greeting =
    currentHour < 12
      ? `Bom dia, ${firstName}`
      : currentHour < 18
        ? `Boa tarde, ${firstName}`
        : `Boa noite, ${firstName}`;

  const heroStats = [
    {
      label: "Atualizado em",
      value: toLongDateLabel(now),
    },
    {
      label: "Compromissos hoje",
      value: toLocaleNumber(agendaHojeTotal),
    },
    {
      label: "Pendências do dia",
      value: toLocaleNumber(totalCritical),
    },
  ];

  const highlights = buildHighlights({
    timelineSeries,
    teamLoad: teamLoad.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    distribution,
  });

  return {
    title: "Painel",
    sectionTitle: "Painel Administrativo",
    navKey: "home",
    layout: "partials/app.ejs",
    pageClass: "page-dashboard",
    extraCss: ["/css/dashboard.css"],
    extraJs: ["/js/dashboard-home.js"],
    hero: {
      greeting,
      subtitle:
        "Uma visão mais clara da operação social para decidir rápido, acompanhar gargalos e agir antes que o atraso apareça na ponta.",
      stats: heroStats,
      search: {
        enabled: canViewFamilies,
        action: "/familias",
        placeholder: "Buscar responsável, assistido ou telefone...",
        canUseSuggestions: canViewFamilies && canUseGlobalSearch,
      },
      quickActions,
    },
    summaryCards,
    alerts: alertItems.slice(0, 3),
    birthdayWidget,
    charts: {
      timeline: {
        title: "Evolução de cadastros e atendimentos",
        subtitle:
          "Compare os dois fluxos ao longo dos últimos meses para identificar crescimento, sazonalidade e momentos de sobrecarga.",
        series6: timelineSeries.slice(-6),
        series12: timelineSeries,
        totals: {
          cadastros6: timelineSeries.slice(-6).reduce((sum, item) => sum + Number(item.cadastros || 0), 0),
          atendimentos6: timelineSeries.slice(-6).reduce((sum, item) => sum + Number(item.atendimentos || 0), 0),
        },
      },
      distribution: {
        title: "Status da agenda do mês",
        subtitle: "Leitura rápida da agenda atual para destacar comparecimento, pendências e pontos de atenção.",
        total: distribution.total,
        gradient: distribution.gradient,
        items: distribution.items,
      },
      teamLoad: {
        title: "Carga da equipe nos últimos 30 dias",
        subtitle: "Veja quem concentrou mais agendamentos para equilibrar distribuição e suporte.",
        items: teamLoad,
      },
    },
    highlights,
    recentRows,
    viewFlags: {
      canViewFamilies,
    },
    emptyStates: {
      recentRows: canViewFamilies
        ? "Nenhum cadastro recente encontrado para o escopo atual."
        : "Sem permissão para visualizar cadastros recentes.",
      teamLoad: canViewAgenda
        ? "Sem movimentação de agenda suficiente para montar o comparativo."
        : "Sem permissão para visualizar a carga da agenda.",
      distribution: canViewAgenda
        ? "Nenhum agendamento encontrado no mês atual."
        : "Sem permissão para visualizar o status da agenda.",
    },
    dashboardData: {
      timeline: {
        series6: timelineSeries.slice(-6),
        series12: timelineSeries,
      },
      search: {
        enabled: canViewFamilies && canUseGlobalSearch,
        endpoint: "/busca",
      },
    },
  };
}

module.exports = {
  buildDashboardViewModel,
};
