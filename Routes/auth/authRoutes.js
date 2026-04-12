const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const AuthController = require("../../Controllers/auth/AuthController");
const { requireAuth } = require("../../middlewares/authSession");
const {
  attachCsrfLocals,
  createCsrfError,
  resolveCsrfTokenFromRequest,
  tokensMatch,
} = require("../../middlewares/csrfProtection");
const { createAdaptiveThrottleGuard } = require("../../services/security/adaptiveThrottleService");
const { ASSET_DEFINITIONS } = require("../../services/security/secureVolunteerAssetService");

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

const cadastroUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 2,
    fileSize: Math.max(
      ASSET_DEFINITIONS.documentoIdentidade.maxBytes,
      ASSET_DEFINITIONS.fotoPerfil.maxBytes
    ),
  },
});

function handleCadastroUploads(req, res, next) {
  cadastroUpload.fields([
    { name: "documentoIdentidadeArquivo", maxCount: 1 },
    { name: "fotoPerfilArquivo", maxCount: 1 },
  ])(req, res, (error) => {
    req.uploadError = error || null;
    next();
  });
}

function enforceCsrfAfterUpload(req, res, next) {
  const expectedToken = attachCsrfLocals(req, res);
  const receivedToken = resolveCsrfTokenFromRequest(req);
  if (!tokensMatch(expectedToken, receivedToken)) {
    return next(createCsrfError());
  }
  return next();
}

router.get("/login", AuthController.loginPage);
router.post("/login", loginLimiter, loginAdaptiveGuard, AuthController.login);
router.get("/cadastro", AuthController.cadastroPage);
router.post(
  "/cadastro",
  cadastroLimiter,
  cadastroAdaptiveGuard,
  handleCadastroUploads,
  enforceCsrfAfterUpload,
  AuthController.cadastro
);
router.post("/logout", requireAuth, AuthController.logout);
router.get("/me", requireAuth, AuthController.me);

module.exports = router;
