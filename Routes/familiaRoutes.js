const express = require("express");
const FamiliaController = require("../Controllers/FamiliaController");
const { requireRole } = require("../middlewares/authSession");
const { PERFIS } = require("../config/roles");

const router = express.Router();

router.get("/", FamiliaController.listar);
router.get("/:id", FamiliaController.detalhar);

router.post(
  "/",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  FamiliaController.criar
);

router.put(
  "/:id",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  FamiliaController.atualizar
);

router.patch(
  "/:id/status",
  requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE),
  FamiliaController.alterarStatus
);

module.exports = router;

