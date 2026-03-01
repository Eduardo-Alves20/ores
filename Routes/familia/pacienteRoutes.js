const express = require("express");
const PacienteController = require("../../Controllers/familia/PacienteController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/familias/:familiaId/pacientes",
  requirePermission(PERMISSIONS.PACIENTES_VIEW),
  PacienteController.listarPorFamilia
);

router.post(
  "/familias/:familiaId/pacientes",
  requirePermission(PERMISSIONS.PACIENTES_CREATE),
  PacienteController.criar
);

router.put(
  "/pacientes/:id",
  requirePermission(PERMISSIONS.PACIENTES_UPDATE),
  PacienteController.atualizar
);

router.patch(
  "/pacientes/:id/status",
  requirePermission(PERMISSIONS.PACIENTES_STATUS),
  PacienteController.alterarStatus
);

module.exports = router;


