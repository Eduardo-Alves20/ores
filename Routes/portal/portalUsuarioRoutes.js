const express = require("express");
const PortalUsuarioController = require("../../Controllers/portal/PortalUsuarioController");
const { requireAuth, requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get("/meus-dados", requireAuth, requirePermission(PERMISSIONS.PORTAL_MEUS_DADOS), PortalUsuarioController.meusDados);
router.get("/minha-familia", requireAuth, requirePermission(PERMISSIONS.PORTAL_MINHA_FAMILIA), PortalUsuarioController.minhaFamilia);

module.exports = router;


