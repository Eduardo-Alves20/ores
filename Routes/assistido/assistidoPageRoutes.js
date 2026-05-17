const express = require("express");
const AssistidoPageController = require("../../Controllers/assistido/AssistidoPageController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get("/", AssistidoPageController.listar);
router.get("/novo", requirePermission(PERMISSIONS.ASSISTIDOS_CREATE), AssistidoPageController.novo);
router.get("/:id/editar", requirePermission(PERMISSIONS.ASSISTIDOS_UPDATE), AssistidoPageController.editar);
router.get("/:id", AssistidoPageController.detalhar);

module.exports = router;
