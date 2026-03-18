const express = require("express");
const FamiliaPageController = require("../../Controllers/familia/FamiliaPageController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get("/", FamiliaPageController.listar);
router.get("/nova", requirePermission(PERMISSIONS.FAMILIAS_CREATE), FamiliaPageController.novo);
router.get("/:id/editar", requirePermission(PERMISSIONS.FAMILIAS_UPDATE), FamiliaPageController.editar);
router.get("/:id", FamiliaPageController.detalhar);

module.exports = router;



