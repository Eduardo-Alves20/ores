const express = require("express");
const FamiliaPageController = require("../../Controllers/familia/FamiliaPageController");

const router = express.Router();

router.get("/", FamiliaPageController.listar);
router.get("/nova", FamiliaPageController.novo);
router.get("/:id/editar", FamiliaPageController.editar);
router.get("/:id", FamiliaPageController.detalhar);

module.exports = router;



