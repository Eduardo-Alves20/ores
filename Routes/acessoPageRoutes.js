const express = require("express");
const AcessoPageController = require("../Controllers/AcessoPageController");
const { requireAuth, requireRole } = require("../middlewares/authSession");
const { PERFIS } = require("../config/roles");

const router = express.Router();

router.get(
  "/acessos/familias",
  requireAuth,
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  AcessoPageController.usuariosFamilia
);

router.get(
  "/acessos/voluntarios",
  requireAuth,
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  AcessoPageController.usuariosVoluntario
);

router.get(
  "/acessos/aprovacoes",
  requireAuth,
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  AcessoPageController.aprovacoes
);

router.post(
  "/acessos/:id/aprovar",
  requireAuth,
  requireRole(PERFIS.ADMIN),
  AcessoPageController.aprovar
);

router.post(
  "/acessos/:id/rejeitar",
  requireAuth,
  requireRole(PERFIS.ADMIN),
  AcessoPageController.rejeitar
);

router.post(
  "/acessos/:id/status",
  requireAuth,
  requireRole(PERFIS.ADMIN),
  AcessoPageController.alterarStatus
);

module.exports = router;
