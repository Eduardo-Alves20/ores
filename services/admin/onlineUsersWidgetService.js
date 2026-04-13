const mongoose = require("mongoose");

const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");

const DEFAULT_ONLINE_WINDOW_MINUTES = 10;
const DEFAULT_MAX_ONLINE_USERS = 12;
const DEFAULT_SCAN_LIMIT = 2000;

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function parseSessionPayload(raw) {
  if (!raw) return null;

  if (typeof raw === "object" && !Buffer.isBuffer(raw)) {
    return raw;
  }

  const asText = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "").trim();
  if (!asText) return null;

  try {
    return JSON.parse(asText);
  } catch (_) {
    return null;
  }
}

function parseDateValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function resolveLastActivity(payload, fallback = null) {
  const direct = parseDateValue(payload?.lastActivityAt);
  if (direct) return direct;

  const fromUser = parseDateValue(payload?.user?.lastActivityAt);
  if (fromUser) return fromUser;

  return fallback;
}

function profileLabel(perfil) {
  const normalized = String(perfil || "").trim().toLowerCase();
  if (normalized === PERFIS.SUPERADMIN) return "SuperAdmin";
  if (normalized === PERFIS.ADMIN) return "Admin";
  if (normalized === PERFIS.ATENDENTE) return "Atendente";
  if (normalized === PERFIS.TECNICO) return "Tecnico";
  if (normalized === PERFIS.USUARIO) return "Usuario";
  return normalized || "Usuario";
}

function formatLastSeenLabel(lastSeen, now) {
  const diffMs = Math.max(now.getTime() - lastSeen.getTime(), 0);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) {
    return {
      label: "Agora",
      isNow: true,
    };
  }

  if (diffMinutes < 60) {
    return {
      label: `${diffMinutes} min`,
      isNow: false,
    };
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return {
    label: `${diffHours} h`,
    isNow: false,
  };
}

async function buildOnlineUsersWidget({ enabled = false, currentSessionUser = null } = {}) {
  const windowMinutes = parsePositiveInt(
    process.env.ONLINE_USERS_WINDOW_MINUTES,
    DEFAULT_ONLINE_WINDOW_MINUTES
  );
  const maxUsers = parsePositiveInt(process.env.ONLINE_USERS_MAX, DEFAULT_MAX_ONLINE_USERS);
  const scanLimit = parsePositiveInt(process.env.ONLINE_USERS_SCAN_LIMIT, DEFAULT_SCAN_LIMIT);

  if (!enabled) {
    return {
      enabled: false,
      total: 0,
      items: [],
      windowMinutes,
      emptyMessage: "",
    };
  }

  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      enabled: true,
      total: 0,
      items: [],
      windowMinutes,
      emptyMessage: "Dados de sessao indisponiveis no momento.",
    };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const sessionDocs = await mongoose.connection.db
    .collection("sessions")
    .find(
      {
        expires: {
          $gt: now,
        },
      },
      {
        projection: {
          session: 1,
          expires: 1,
        },
      }
    )
    .sort({ expires: -1 })
    .limit(scanLimit)
    .toArray();

  const byUserId = new Map();

  (Array.isArray(sessionDocs) ? sessionDocs : []).forEach((doc) => {
    const payload = parseSessionPayload(doc?.session);
    const sessionUser = payload?.user || null;
    const userId = String(sessionUser?.id || "").trim();
    if (!userId) return;

    const lastSeen = resolveLastActivity(payload);
    if (!lastSeen || lastSeen < cutoff) return;

    const current = byUserId.get(userId) || null;
    if (!current) {
      byUserId.set(userId, {
        userId,
        nome: String(sessionUser?.nome || "").trim(),
        perfil: String(sessionUser?.perfil || "").trim().toLowerCase(),
        lastSeen,
        sessions: 1,
      });
      return;
    }

    current.sessions += 1;
    if (lastSeen > current.lastSeen) {
      current.lastSeen = lastSeen;
      if (sessionUser?.nome) current.nome = String(sessionUser.nome).trim();
      if (sessionUser?.perfil) current.perfil = String(sessionUser.perfil).trim().toLowerCase();
    }
  });

  const currentUserId = String(currentSessionUser?.id || "").trim();
  if (currentUserId) {
    const current = byUserId.get(currentUserId) || null;
    if (!current) {
      byUserId.set(currentUserId, {
        userId: currentUserId,
        nome: String(currentSessionUser?.nome || "").trim(),
        perfil: String(currentSessionUser?.perfil || "").trim().toLowerCase(),
        lastSeen: now,
        sessions: 1,
      });
    } else {
      current.lastSeen = now;
    }
  }

  const userIds = Array.from(byUserId.keys()).filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  const users = userIds.length
    ? await Usuario.find({
        _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
        ativo: true,
      })
        .select("_id nome perfil statusAprovacao ativo")
        .lean()
    : [];
  const userMap = new Map(users.map((item) => [String(item._id), item]));

  const onlineItems = Array.from(byUserId.values())
    .map((entry) => {
      const dbUser = userMap.get(entry.userId);
      if (!dbUser?._id) return null;
      if (String(dbUser?.perfil || "").toLowerCase() === PERFIS.USUARIO) {
        const approval = String(dbUser?.statusAprovacao || "").toLowerCase();
        if (approval && approval !== "aprovado") return null;
      }

      const activity = formatLastSeenLabel(entry.lastSeen, now);

      return {
        id: entry.userId,
        nome: String(dbUser?.nome || entry.nome || "Usuario"),
        perfil: String(dbUser?.perfil || entry.perfil || "").toLowerCase(),
        perfilLabel: profileLabel(dbUser?.perfil || entry.perfil),
        lastSeenAt: entry.lastSeen.toISOString(),
        lastSeenLabel: activity.label,
        isNow: activity.isNow,
        sessions: entry.sessions,
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.lastSeenAt) - new Date(left.lastSeenAt));

  return {
    enabled: true,
    total: onlineItems.length,
    items: onlineItems.slice(0, maxUsers),
    windowMinutes,
    generatedAt: now.toISOString(),
    emptyMessage: `Nenhum usuario ativo nos ultimos ${windowMinutes} minutos.`,
  };
}

module.exports = {
  buildOnlineUsersWidget,
};
