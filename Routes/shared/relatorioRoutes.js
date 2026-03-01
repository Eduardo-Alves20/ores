const express = require("express");
const RelatorioController = require("../../Controllers/shared/RelatorioController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/relatorios/cadastros-por-mes",
  requirePermission(PERMISSIONS.RELATORIOS_VIEW),
  RelatorioController.cadastrosPorMes
);

router.get(
  "/relatorios/atendimentos-por-mes",
  requirePermission(PERMISSIONS.RELATORIOS_VIEW),
  RelatorioController.atendimentosPorMes
);

module.exports = router;


