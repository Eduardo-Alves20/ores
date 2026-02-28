const express = require("express");
const RelatorioController = require("../Controllers/RelatorioController");
const { requireRole } = require("../middlewares/authSession");
const { PERFIS } = require("../config/roles");

const router = express.Router();

router.get(
  "/relatorios/cadastros-por-mes",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  RelatorioController.cadastrosPorMes
);

router.get(
  "/relatorios/atendimentos-por-mes",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  RelatorioController.atendimentosPorMes
);

module.exports = router;

