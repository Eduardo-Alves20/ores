const express = require("express");
const rateLimit = require("express-rate-limit");
const AuthController = require("../Controllers/AuthController");
const { requireAuth } = require("../middlewares/authSession");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
});

router.get("/login", AuthController.loginPage);
router.post("/login", loginLimiter, AuthController.login);
router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.me);
router.get("/administracao", requireAuth, (req, res) => res.redirect("/painel"));

module.exports = router;
