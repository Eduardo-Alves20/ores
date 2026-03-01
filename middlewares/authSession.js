const { PERFIS } = require("../config/roles");
const {
  hasAnyPermission,
  resolvePermissionsFromSession,
} = require("../services/accessControlService");

function getSessionUser(req) {
  return req?.session?.user || null;
}

function isHtmlRequest(req) {
  return !!req.accepts("html");
}

async function attachCurrentUser(req, res, next) {
  try {
    const user = getSessionUser(req);
    if (user && (!Array.isArray(user.permissions) || !user.permissions.length)) {
      await resolvePermissionsFromSession(req);
    }
    req.currentUser = getSessionUser(req);
    res.locals.currentUser = req.currentUser;
    next();
  } catch (error) {
    next(error);
  }
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
          if (String(user.tipoCadastro || "").toLowerCase() === "familia") {
            return res.redirect("/minha-familia");
          }
          return res.redirect("/meus-dados");
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
          if (String(user.tipoCadastro || "").toLowerCase() === "familia") {
            return res.redirect("/minha-familia");
          }
          return res.redirect("/meus-dados");
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

module.exports = {
  attachCurrentUser,
  requireAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
};
