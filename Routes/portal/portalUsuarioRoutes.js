const express = require("express");
const PortalUsuarioController = require("../../Controllers/portal/PortalUsuarioController");
const { requireAuth, requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/meus-dados",
  requireAuth,
  requirePermission(PERMISSIONS.PORTAL_MEUS_DADOS),
  PortalUsuarioController.meusDados
);

module.exports = router;
