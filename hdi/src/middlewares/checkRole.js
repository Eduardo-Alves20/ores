const { resolveScopedAccess } = require("../services/resourceAccessService");

function checkPermission(roleRequired) {
  return async (req, res, next) => {
    try {
      const access = await resolveScopedAccess({
        boardId: req.params?.boardId || req.body?.boardId,
        listId: req.params?.listId,
        cardId: req.params?.cardId,
        userId: req.session?.userId,
        requiredRole: roleRequired,
      });

      req.currentRole = access.currentRole;
      req.securityContext = access;
      return next();
    } catch (error) {
      console.error("Falha de autorizacao do HDI:", error?.message || error);
      return res.status(error?.status || 500).json({
        error: error?.message || "Erro interno",
      });
    }
  };
}

module.exports = checkPermission;
