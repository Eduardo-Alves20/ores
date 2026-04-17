const express = require("express");
const AcessoPageController = require("../../Controllers/admin/AcessoPageController");
const { requireAuth, requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");
const {
  canReviewSensitiveApprovalData,
} = require("../../services/admin/access/accessPermissionService");

const router = express.Router();

function requireApprovalReviewAccess(req, res, next) {
  if (canReviewSensitiveApprovalData(req)) {
    return next();
  }

  if (req.accepts("html")) {
    return res.redirect("/painel");
  }

  return res.status(403).json({
    erro: "Acesso restrito a administracao e assistencia social.",
  });
}

router.get(
  "/acessos/familias",
  requireAuth,
  requirePermission(PERMISSIONS.ACESSOS_VIEW),
  AcessoPageController.usuariosFamilia
);

router.get(
  "/acessos/voluntarios",
  requireAuth,
  requirePermission(PERMISSIONS.ACESSOS_VIEW),
  AcessoPageController.usuariosVoluntario
);

router.get(
  "/acessos/aprovacoes",
  requireAuth,
  requirePermission(PERMISSIONS.ACESSOS_VIEW),
  AcessoPageController.aprovacoes
);

router.get(
  "/acessos/:id/detalhe",
  requireAuth,
  requireApprovalReviewAccess,
  AcessoPageController.detalhe
);

router.get(
  "/acessos/:id/anexos/:kind",
  requireAuth,
  requireApprovalReviewAccess,
  AcessoPageController.visualizarAnexoProtegido
);

router.post(
  "/acessos/:id/aprovar",
  requireAuth,
  requirePermission(PERMISSIONS.ACESSOS_APPROVE),
  AcessoPageController.aprovar
);

router.post(
  "/acessos/:id/rejeitar",
  requireAuth,
  requirePermission(PERMISSIONS.ACESSOS_APPROVE),
  AcessoPageController.rejeitar
);

router.post(
  "/acessos/:id/status",
  requireAuth,
  requirePermission(PERMISSIONS.ACESSOS_APPROVE),
  AcessoPageController.alterarStatus
);

module.exports = router;
