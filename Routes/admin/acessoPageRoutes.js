const express = require("express");
const AcessoPageController = require("../../Controllers/admin/AcessoPageController");
const { requireAuth, requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

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


