const express = require("express");
const BuscaController = require("../../Controllers/shared/BuscaController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

router.get("/busca", requirePermission(PERMISSIONS.BUSCA_GLOBAL), BuscaController.buscar);

module.exports = router;


