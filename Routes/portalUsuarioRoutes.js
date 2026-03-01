const express = require("express");
const PortalUsuarioController = require("../Controllers/PortalUsuarioController");
const { requireAuth } = require("../middlewares/authSession");

const router = express.Router();

router.get("/meus-dados", requireAuth, PortalUsuarioController.meusDados);

module.exports = router;
