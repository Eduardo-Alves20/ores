const { PERFIS } = require("../config/roles");

function getSessionUser(req) {
  return req?.session?.user || null;
}

function isHtmlRequest(req) {
  return !!req.accepts("html");
}

function attachCurrentUser(req, res, next) {
  const user = getSessionUser(req);
  req.currentUser = user;
  res.locals.currentUser = user;
  next();
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

    if (!allowedRoles.includes(user.perfil)) {
      return res.status(403).json({ erro: "Acesso negado para este perfil." });
    }

    return next();
  };
}

const requireAdmin = requireRole(PERFIS.ADMIN);

module.exports = {
  attachCurrentUser,
  requireAuth,
  requireRole,
  requireAdmin,
};

