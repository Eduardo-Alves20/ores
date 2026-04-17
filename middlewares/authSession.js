const { PERFIS } = require("../config/roles");
const {
  hasAnyPermission,
  resolvePermissionsFromSession,
} = require("../services/shared/accessControlService");
const { resolveLandingRouteForUser } = require("../services/shared/navigationService");
const {
  loadSessionValidationSnapshot,
  normalizeAuthVersion,
  resolveSessionInvalidationReason,
} = require("../services/security/sessionSecurityService");

function getSessionUser(req) {
  return req?.session?.user || null;
}

const SESSION_ACTIVITY_MIN_INTERVAL_MS = 60 * 1000;

function markSessionActivity(req) {
  if (!req?.session || !req?.session?.user) return;

  const now = Date.now();
  const previous = Date.parse(String(req.session.lastActivityAt || ""));

  if (!Number.isFinite(previous) || now - previous >= SESSION_ACTIVITY_MIN_INTERVAL_MS) {
    req.session.lastActivityAt = new Date(now).toISOString();
  }
}

function isHtmlRequest(req) {
  return !!req.accepts("html");
}

function clearSessionCookies(res) {
  res.clearCookie(process.env.SESSION_NAME || "ORES.sid");
  res.clearCookie("connect.sid");
}

async function destroySession(req) {
  if (!req?.session || typeof req.session.destroy !== "function") {
    return;
  }

  await new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });
}

async function invalidateAuthenticatedSession(req, res) {
  await destroySession(req);
  clearSessionCookies(res);
}

function createAttachCurrentUser(deps = {}) {
  const resolvePermissions = deps.resolvePermissionsFromSession || resolvePermissionsFromSession;
  const loadSnapshot = deps.loadSessionValidationSnapshot || loadSessionValidationSnapshot;

  return async function attachCurrentUser(req, res, next) {
    try {
      const user = getSessionUser(req);

      if (user) {
        const snapshot = await loadSnapshot(user.id);
        const invalidationReason = resolveSessionInvalidationReason(user, snapshot);

        if (invalidationReason) {
          await invalidateAuthenticatedSession(req, res);

          if (isHtmlRequest(req)) {
            return res.redirect("/login?reason=sessao_revogada");
          }

          return res.status(401).json({
            erro: "Sessao invalida ou expirada. Faca login novamente.",
          });
        }

        req.session.user.nome = String(snapshot?.nome || "").trim();
        req.session.user.email = String(snapshot?.email || "").trim().toLowerCase();
        req.session.user.authVersion = normalizeAuthVersion(snapshot?.authVersion);
        markSessionActivity(req);
      }

      if (user && (!Array.isArray(user.permissions) || !user.permissions.length)) {
        await resolvePermissions(req);
      }

      req.currentUser = getSessionUser(req);
      res.locals.currentUser = req.currentUser;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (user) return next();

  if (isHtmlRequest(req)) {
    return res.redirect("/login");
  }

  return res.status(401).json({
    erro: "Sessao expirada ou usuario nao autenticado.",
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = getSessionUser(req);

    if (!user) {
      if (isHtmlRequest(req)) return res.redirect("/login");
      return res.status(401).json({ erro: "Nao autenticado." });
    }

    const perfil = String(user.perfil || "").toLowerCase();
    if (perfil !== PERFIS.SUPERADMIN && !allowedRoles.includes(perfil)) {
      if (isHtmlRequest(req)) {
        if (user.perfil === PERFIS.USUARIO) {
          return res.redirect(resolveLandingRouteForUser(user));
        }

        const err = new Error("Acesso negado para este perfil.");
        err.status = 403;
        err.publicMessage = "Voce nao tem permissao para acessar esta pagina.";
        return next(err);
      }

      return res.status(403).json({ erro: "Acesso negado para este perfil." });
    }

    return next();
  };
}

function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
    try {
      const user = getSessionUser(req);
      if (!user) {
        if (isHtmlRequest(req)) return res.redirect("/login");
        return res.status(401).json({ erro: "Nao autenticado." });
      }

      const permissions = await resolvePermissionsFromSession(req);
      const allowed = hasAnyPermission(permissions, requiredPermissions);

      if (allowed) return next();

      if (isHtmlRequest(req)) {
        if (user.perfil === PERFIS.USUARIO) {
          return res.redirect(resolveLandingRouteForUser(user));
        }

        const err = new Error("Acesso negado para esta permissao.");
        err.status = 403;
        err.publicMessage = "Voce nao tem permissao para acessar esta pagina.";
        return next(err);
      }

      return res.status(403).json({ erro: "Acesso negado para esta permissao." });
    } catch (error) {
      return next(error);
    }
  };
}

const requireAdmin = requireRole(PERFIS.SUPERADMIN, PERFIS.ADMIN);
const requireSuperAdmin = requireRole(PERFIS.SUPERADMIN);
const attachCurrentUser = createAttachCurrentUser();

module.exports = {
  attachCurrentUser,
  clearSessionCookies,
  createAttachCurrentUser,
  destroySession,
  invalidateAuthenticatedSession,
  requireAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
};
