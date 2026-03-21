const { Notificacao } = require("../../../schemas/core/Notificacao");
const {
  FAMILY_NOTIFICATION_LIMIT_OPTIONS,
} = require("./portalFamilyPolicyService");
const { mapNotificationCard } = require("./portalFamilyFormattingService");

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

function buildNotificationBaseFilter(userId) {
  return {
    usuarioId: userId,
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
  const filtroBase = buildNotificationBaseFilter(userId);
  const filtroLista = {
    ...filtroBase,
    ...buildNotificationStatusFilter(status),
    ...buildNotificationTypeFilter(tipo),
  };

  const [docs, total, unread] = await Promise.all([
    Notificacao.find(filtroLista).sort({ createdAt: -1 }).limit(limit).lean(),
    Notificacao.countDocuments(filtroBase),
    Notificacao.countDocuments({ ...filtroBase, lidoEm: null }),
  ]);

  const notificacoes = docs.map(mapNotificationCard);
  const alertas = notificacoes.filter((item) => item.tipo === "alert").length;

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
      alerts: alertas,
      listed: notificacoes.length,
    },
    filtros: {
      tipo,
      status,
      limit,
      limitOptions: FAMILY_NOTIFICATION_LIMIT_OPTIONS,
    },
  };
}

async function markPortalFamilyNotificationAsRead({ userId, notificationId }) {
  if (!userId || !notificationId) return null;

  return Notificacao.findOneAndUpdate(
    {
      _id: notificationId,
      usuarioId: userId,
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
  if (!userId) return null;

  return Notificacao.updateMany(
    {
      usuarioId: userId,
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
  parseNotificationLimit,
  parseNotificationStatus,
  parseNotificationType,
};
