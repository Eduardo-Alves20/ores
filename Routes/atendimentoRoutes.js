const express = require("express");
const AtendimentoController = require("../Controllers/AtendimentoController");
const { requireRole } = require("../middlewares/authSession");
const { PERFIS } = require("../config/roles");

const router = express.Router();

router.get("/familias/:familiaId/atendimentos", AtendimentoController.listarPorFamilia);

router.post(
  "/familias/:familiaId/atendimentos",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AtendimentoController.criar
);

router.put(
  "/atendimentos/:id",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AtendimentoController.atualizar
);

router.patch(
  "/atendimentos/:id/status",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AtendimentoController.alterarStatus
);

module.exports = router;
