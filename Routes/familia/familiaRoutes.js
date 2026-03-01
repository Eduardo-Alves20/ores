const express = require("express");
const FamiliaController = require("../../Controllers/familia/FamiliaController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get("/", requirePermission(PERMISSIONS.FAMILIAS_VIEW), FamiliaController.listar);
router.get("/:id", requirePermission(PERMISSIONS.FAMILIAS_VIEW), FamiliaController.detalhar);

router.post(
  "/",
  requirePermission(PERMISSIONS.FAMILIAS_CREATE),
  FamiliaController.criar
);

router.put(
  "/:id",
  requirePermission(PERMISSIONS.FAMILIAS_UPDATE),
  FamiliaController.atualizar
);

router.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.FAMILIAS_STATUS),
  FamiliaController.alterarStatus
);

module.exports = router;


