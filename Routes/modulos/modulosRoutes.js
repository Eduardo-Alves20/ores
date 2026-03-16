const express = require("express");
const ModulosPageController = require("../../Controllers/modulos/ModulosPageController");
const { requireAuth } = require("../../middlewares/authSession");

const router = express.Router();

router.get("/modulos/:slug/acessar", requireAuth, ModulosPageController.bridge);
router.get("/modulos/:slug", requireAuth, ModulosPageController.show);

module.exports = router;
