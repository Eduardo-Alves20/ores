const express = require("express");
const PortalUsuarioController = require("../../Controllers/portal/PortalUsuarioController");
const PortalFamiliaController = require("../../Controllers/portal/PortalFamiliaController");
const { requireAuth, requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/meus-dados",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MEUS_DADOS),
  PortalUsuarioController.meusDados
);
router.get(
  "/minha-familia",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.inicio
);
router.get(
  "/minha-familia/consultas",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.consultas
);
router.get(
  "/minha-familia/consultas/eventos",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.consultasEventos
);
router.patch(
  "/minha-familia/consultas/eventos/:id/falta",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.registrarFalta
);
router.post(
  "/minha-familia/consultas/eventos/:id/remarcacao",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.solicitarRemarcacao
);
router.get(
  "/minha-familia/notificacoes",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.notificacoes
);
router.post(
  "/minha-familia/notificacoes/lidas",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.marcarTodasNotificacoesLidas
);
router.post(
  "/minha-familia/notificacoes/:id/lida",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.marcarNotificacaoLida
);

module.exports = router;


