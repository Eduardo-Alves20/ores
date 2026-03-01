const express = require("express");
const AtendimentoController = require("../../Controllers/familia/AtendimentoController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/familias/:familiaId/atendimentos",
  requirePermission(PERMISSIONS.ATENDIMENTOS_VIEW),
  AtendimentoController.listarPorFamilia
);

router.post(
  "/familias/:familiaId/atendimentos",
  requirePermission(PERMISSIONS.ATENDIMENTOS_CREATE),
  AtendimentoController.criar
);

router.put(
  "/atendimentos/:id",
  requirePermission(PERMISSIONS.ATENDIMENTOS_UPDATE),
  AtendimentoController.atualizar
);

router.patch(
  "/atendimentos/:id/status",
  requirePermission(PERMISSIONS.ATENDIMENTOS_STATUS),
  AtendimentoController.alterarStatus
);

module.exports = router;


