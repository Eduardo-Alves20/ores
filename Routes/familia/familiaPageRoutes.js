const express = require("express");
const FamiliaPageController = require("../../Controllers/familia/FamiliaPageController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get("/", FamiliaPageController.listar);
router.get("/nova", requirePermission(PERMISSIONS.FAMILIAS_CREATE), FamiliaPageController.novo);
router.post("/nova", requirePermission(PERMISSIONS.FAMILIAS_CREATE), FamiliaPageController.criarViaFormulario);
router.get("/:id/editar", requirePermission(PERMISSIONS.FAMILIAS_UPDATE), FamiliaPageController.editar);
router.post("/:id/editar", requirePermission(PERMISSIONS.FAMILIAS_UPDATE), FamiliaPageController.atualizarViaFormulario);
router.get("/:id", FamiliaPageController.detalhar);

module.exports = router;



