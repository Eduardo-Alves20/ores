const express = require("express");
const RelatorioController = require("../../Controllers/shared/RelatorioController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/relatorios/consultas/profissional/:professionalId",
  requirePermission(PERMISSIONS.RELATORIOS_VIEW),
  RelatorioController.dashboardConsultasProfissional
);

router.get(
  "/relatorios/consultas/distribuicao-semana",
  requirePermission(PERMISSIONS.RELATORIOS_VIEW),
  RelatorioController.dashboardConsultasDistribuicaoSemana
);

router.get(
  "/relatorios/consultas",
  requirePermission(PERMISSIONS.RELATORIOS_VIEW),
  RelatorioController.dashboardConsultas
);

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
