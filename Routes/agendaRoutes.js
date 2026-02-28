const express = require("express");
const AgendaController = require("../Controllers/AgendaController");
const { requireRole } = require("../middlewares/authSession");
const { PERFIS } = require("../config/roles");

const router = express.Router();

router.get(
  "/agenda/profissionais",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AgendaController.listarProfissionais
);

router.get(
  "/agenda/eventos",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AgendaController.listar
);

router.post(
  "/agenda/eventos",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AgendaController.criar
);

router.put(
  "/agenda/eventos/:id",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AgendaController.atualizar
);

router.patch(
  "/agenda/eventos/:id/mover",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AgendaController.mover
);

router.patch(
  "/agenda/eventos/:id/status",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO),
  AgendaController.alterarStatus
);

module.exports = router;

