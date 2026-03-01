const express = require("express");
const AgendaController = require("../../Controllers/agenda/AgendaController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get(
  "/agenda/profissionais",
  requirePermission(PERMISSIONS.AGENDA_VIEW),
  AgendaController.listarProfissionais
);

router.get(
  "/agenda/eventos",
  requirePermission(PERMISSIONS.AGENDA_VIEW),
  AgendaController.listar
);

router.post(
  "/agenda/eventos",
  requirePermission(PERMISSIONS.AGENDA_CREATE),
  AgendaController.criar
);

router.put(
  "/agenda/eventos/:id",
  requirePermission(PERMISSIONS.AGENDA_UPDATE),
  AgendaController.atualizar
);

router.patch(
  "/agenda/eventos/:id/mover",
  requirePermission(PERMISSIONS.AGENDA_MOVE),
  AgendaController.mover
);

router.patch(
  "/agenda/eventos/:id/status",
  requirePermission(PERMISSIONS.AGENDA_STATUS),
  AgendaController.alterarStatus
);

module.exports = router;


