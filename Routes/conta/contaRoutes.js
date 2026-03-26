const express = require("express");
const ContaController = require("../../Controllers/conta/ContaController");
const { requireAuth } = require("../../middlewares/authSession");
const { passwordMutationLimiter } = require("../../middlewares/rateLimiters");

const router = express.Router();

router.get("/perfil", requireAuth, ContaController.perfil);
router.get("/perfil/editar", requireAuth, ContaController.editarPerfilPage);
router.post("/perfil/editar", requireAuth, ContaController.editarPerfil);
router.post("/perfil/senha", requireAuth, passwordMutationLimiter, ContaController.alterarSenha);
router.get("/notificacoes", requireAuth, ContaController.notificacoes);

module.exports = router;


