const { Notificacao } = require("../../../schemas/core/Notificacao");
const {
  isValidObjectIdInput,
} = require("../../shared/objectIdValidationService");
const {
  FAMILY_NOTIFICATION_LIMIT_OPTIONS,
} = require("./portalFamilyPolicyService");
const { mapNotificationCard } = require("./portalFamilyFormattingService");
const { escapeRegex } = require("../../shared/searchUtilsService");

function parseNotificationType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["alert", "info"].includes(normalized)) return normalized;
  return "todos";
}

function parseNotificationStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["lidas", "nao_lidas"].includes(normalized)) return normalized;
  return "todos";
}

function parseNotificationLimit(value, fallback = 20) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (FAMILY_NOTIFICATION_LIMIT_OPTIONS.includes(parsed)) return parsed;
  return fallback;
}

function parseNotificationSearch(value) {
  return String(value || "").trim().slice(0, 80);
}

function normalizeNotificationUserId(userId) {
  return isValidObjectIdInput(userId) ? String(userId).trim() : "";
}

function normalizeNotificationId(notificationId) {
  return isValidObjectIdInput(notificationId) ? String(notificationId).trim() : "";
}

function buildNotificationBaseFilter(userId) {
  const normalizedUserId = normalizeNotificationUserId(userId);
  if (!normalizedUserId) return null;

  return {
    usuarioId: normalizedUserId,
    canal: "sistema",
  };
}

function buildNotificationTypeFilter(tipo) {
  if (tipo === "alert") {
    return {
      $or: [
        { evento: /cancel/i },
        { evento: /falta/i },
        { "payload.meta.kind": /cancel|falta/i },
      ],
    };
  }

  if (tipo === "info") {
    return {
      $and: [
        {
          $nor: [
            { evento: /cancel/i },
            { evento: /falta/i },
            { "payload.meta.kind": /cancel|falta/i },
          ],
        },
      ],
    };
  }

  return {};
}

function buildNotificationStatusFilter(status) {
  if (status === "lidas") {
    return { lidoEm: { $ne: null } };
  }

  if (status === "nao_lidas") {
    return { lidoEm: null };
  }

  return {};
}

function buildNotificationSearchFilter(busca) {
  if (!busca) return {};
  const regex = new RegExp(escapeRegex(busca), "i");
  return {
    $or: [
      { titulo: regex },
      { mensagem: regex },
      { evento: regex },
      { "payload.meta.kind": regex },
    ],
  };
}

async function loadPortalFamilyNotificationSummary(userId) {
  if (!userId) {
    return {
      total: 0,
      unread: 0,
      alerts: 0,
      recent: [],
    };
  }

  const filtroBase = buildNotificationBaseFilter(userId);
  if (!filtroBase) {
    return {
      total: 0,
      unread: 0,
      alerts: 0,
      recent: [],
    };
  }

  const [total, unread, alerts, recentDocs] = await Promise.all([
    Notificacao.countDocuments(filtroBase),
    Notificacao.countDocuments({ ...filtroBase, lidoEm: null }),
    Notificacao.countDocuments({
      ...filtroBase,
      $or: [
        { evento: /cancel/i },
        { evento: /falta/i },
        { "payload.meta.kind": /cancel|falta/i },
      ],
    }),
    Notificacao.find(filtroBase)
      .sort({ createdAt: -1 })
      .limit(3)
      .lean(),
  ]);

    return {
      total,
      unread,
      alerts,
      recent: recentDocs.map(mapNotificationCard),
    };
  }

async function buildPortalFamilyNotificationsPageView({ userId, query = {} }) {
  const tipo = parseNotificationType(query?.tipo);
  const status = parseNotificationStatus(query?.status);
  const limit = parseNotificationLimit(query?.limit, 20);
  const busca = parseNotificationSearch(query?.busca);
  const filtroBase = buildNotificationBaseFilter(userId);
  if (!filtroBase) {
    return {
      title: "Notificacoes da Familia",
      sectionTitle: "Notificacoes da Familia",
      navKey: "minha-familia-notificacoes",
      layout: "partials/app.ejs",
      pageClass: "page-usuario-minha-familia-notificacoes",
      extraCss: ["/css/usuario-familia.css"],
      notificacoes: [],
      notificationCount: 0,
      totais: {
        total: 0,
        unread: 0,
        alerts: 0,
        listed: 0,
      },
      filtros: {
        tipo,
        status,
        limit,
        busca,
        limitOptions: FAMILY_NOTIFICATION_LIMIT_OPTIONS,
      },
    };
  }

  const filtroLista = {
    ...filtroBase,
    ...buildNotificationStatusFilter(status),
    ...buildNotificationTypeFilter(tipo),
    ...buildNotificationSearchFilter(busca),
  };

  const [docs, total, unread, alerts] = await Promise.all([
    Notificacao.find(filtroLista).sort({ createdAt: -1 }).limit(limit).lean(),
    Notificacao.countDocuments(filtroBase),
    Notificacao.countDocuments({ ...filtroBase, lidoEm: null }),
    Notificacao.countDocuments({
      ...filtroBase,
      ...buildNotificationTypeFilter("alert"),
    }),
  ]);

  const notificacoes = docs.map(mapNotificationCard);

  return {
    title: "Notificacoes da Familia",
    sectionTitle: "Notificacoes da Familia",
    navKey: "minha-familia-notificacoes",
    layout: "partials/app.ejs",
    pageClass: "page-usuario-minha-familia-notificacoes",
    extraCss: ["/css/usuario-familia.css"],
    notificacoes,
    notificationCount: unread,
    totais: {
      total,
      unread,
      alerts,
      listed: notificacoes.length,
    },
    filtros: {
      tipo,
      status,
      limit,
      busca,
      limitOptions: FAMILY_NOTIFICATION_LIMIT_OPTIONS,
    },
  };
}

async function markPortalFamilyNotificationAsRead({ userId, notificationId }) {
  const normalizedUserId = normalizeNotificationUserId(userId);
  const normalizedNotificationId = normalizeNotificationId(notificationId);
  if (!normalizedUserId || !normalizedNotificationId) return null;

  return Notificacao.findOneAndUpdate(
    {
      _id: normalizedNotificationId,
      usuarioId: normalizedUserId,
      canal: "sistema",
    },
    {
      lidoEm: new Date(),
    },
    {
      new: true,
    }
  ).lean();
}

async function markAllPortalFamilyNotificationsAsRead(userId) {
  const normalizedUserId = normalizeNotificationUserId(userId);
  if (!normalizedUserId) return null;

  return Notificacao.updateMany(
    {
      usuarioId: normalizedUserId,
      canal: "sistema",
      lidoEm: null,
    },
    {
      $set: {
        lidoEm: new Date(),
      },
    }
  );
}

module.exports = {
  buildPortalFamilyNotificationsPageView,
  loadPortalFamilyNotificationSummary,
  markAllPortalFamilyNotificationsAsRead,
  markPortalFamilyNotificationAsRead,
  normalizeNotificationId,
  normalizeNotificationUserId,
  parseNotificationLimit,
  parseNotificationSearch,
  parseNotificationStatus,
  parseNotificationType,
};
