const express = require("express");
const PacienteController = require("../Controllers/PacienteController");
const { requireRole } = require("../middlewares/authSession");
const { PERFIS } = require("../config/roles");

const router = express.Router();

router.get("/familias/:familiaId/pacientes", PacienteController.listarPorFamilia);

router.post(
  "/familias/:familiaId/pacientes",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  PacienteController.criar
);

router.put(
  "/pacientes/:id",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  PacienteController.atualizar
);

router.patch(
  "/pacientes/:id/status",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  PacienteController.alterarStatus
);

module.exports = router;

