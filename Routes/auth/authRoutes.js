const express = require("express");
const rateLimit = require("express-rate-limit");
const AuthController = require("../../Controllers/auth/AuthController");
const { requireAuth } = require("../../middlewares/authSession");
const { PERFIS } = require("../../config/roles");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
});

const cadastroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
});

router.get("/login", AuthController.loginPage);
router.post("/login", loginLimiter, AuthController.login);
router.get("/cadastro", AuthController.cadastroPage);
router.post("/cadastro", cadastroLimiter, AuthController.cadastro);
router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.me);
router.get("/administracao", requireAuth, (req, res) => {
  if (req?.session?.user?.perfil === PERFIS.USUARIO) {
    return res.redirect("/meus-dados");
  }
  return res.redirect("/painel");
});

module.exports = router;


