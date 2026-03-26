const express = require("express");
const rateLimit = require("express-rate-limit");
const AuthController = require("../../Controllers/auth/AuthController");
const { requireAuth } = require("../../middlewares/authSession");
const { createAdaptiveThrottleGuard } = require("../../services/security/adaptiveThrottleService");

const router = express.Router();
const isDevLike = ["dev", "development", "local", "test", "teste"].includes(
  String(process.env.AMBIENTE || process.env.NODE_ENV || "").trim().toLowerCase()
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevLike ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
});

const cadastroLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
});

const loginAdaptiveGuard = createAdaptiveThrottleGuard({
  scope: "auth.login",
  threshold: isDevLike ? 20 : 6,
  windowMs: 15 * 60 * 1000,
  blockMs: isDevLike ? 5 * 60 * 1000 : 20 * 60 * 1000,
  message:
    "Muitas tentativas consecutivas de login. Aguarde alguns minutos antes de tentar novamente.",
});

const cadastroAdaptiveGuard = createAdaptiveThrottleGuard({
  scope: "auth.cadastro",
  threshold: isDevLike ? 15 : 5,
  windowMs: 20 * 60 * 1000,
  blockMs: isDevLike ? 5 * 60 * 1000 : 30 * 60 * 1000,
  message:
    "Muitas tentativas de cadastro com falha. Aguarde alguns minutos antes de tentar novamente.",
});

router.get("/login", AuthController.loginPage);
router.post("/login", loginLimiter, loginAdaptiveGuard, AuthController.login);
router.get("/cadastro", AuthController.cadastroPage);
router.post("/cadastro", cadastroLimiter, cadastroAdaptiveGuard, AuthController.cadastro);
router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.me);

module.exports = router;
