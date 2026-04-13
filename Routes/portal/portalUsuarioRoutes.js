const express = require("express");
const PortalUsuarioController = require("../../Controllers/portal/PortalUsuarioController");
const PortalFamiliaController = require("../../Controllers/portal/PortalFamiliaController");
const { requireAuth, requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");
const { portalMutationLimiter } = require("../../middlewares/rateLimiters");

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
router.get(
  "/minha-familia/consultas/profissionais",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.consultasProfissionais
);
router.get(
  "/minha-familia/consultas/profissionais/:id/horarios",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.consultasHorariosProfissional
);
router.post(
  "/minha-familia/consultas/agendar",
  requireAuth,
  portalMutationLimiter,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.agendarConsulta
);
router.patch(
  "/minha-familia/consultas/eventos/:id/falta",
  requireAuth,
  portalMutationLimiter,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.registrarFalta
);
router.post(
  "/minha-familia/consultas/eventos/:id/remarcacao",
  requireAuth,
  portalMutationLimiter,
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
  portalMutationLimiter,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.marcarTodasNotificacoesLidas
);
router.post(
  "/minha-familia/notificacoes/:id/lida",
  requireAuth,
  portalMutationLimiter,
  requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA),
  PortalFamiliaController.marcarNotificacaoLida
);

module.exports = router;


