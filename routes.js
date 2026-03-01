const express = require("express");
const rateLimit = require("express-rate-limit");
const requestIp = require("request-ip");

const authRoutes = require("./Routes/authRoutes");
const usuarioRoutes = require("./Routes/usuarioRoutes");
const familiaRoutes = require("./Routes/familiaRoutes");
const pacienteRoutes = require("./Routes/pacienteRoutes");
const atendimentoRoutes = require("./Routes/atendimentoRoutes");
const buscaRoutes = require("./Routes/buscaRoutes");
const relatorioRoutes = require("./Routes/relatorioRoutes");
const familiaPageRoutes = require("./Routes/familiaPageRoutes");
const agendaRoutes = require("./Routes/agendaRoutes");
const portalUsuarioRoutes = require("./Routes/portalUsuarioRoutes");
const contaRoutes = require("./Routes/contaRoutes");
const acessoPageRoutes = require("./Routes/acessoPageRoutes");
const DashboardController = require("./Controllers/DashboardController");
const AgendaPageController = require("./Controllers/AgendaPageController");
const { PERFIS } = require("./config/roles");

const { requireAuth, requireRole } = require("./middlewares/authSession");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas requisicoes foram feitas a partir deste IP. Tente novamente mais tarde.",
  keyGenerator: (req) => requestIp.getClientIp(req),
});

router.get("/", (req, res) => {
  if (req?.session?.user) {
    if (req.session.user.perfil === PERFIS.USUARIO) {
      return res.redirect("/meus-dados");
    }
    return res.redirect("/painel");
  }
  return res.redirect("/login");
});

router.get("/health", (req, res) => {
  return res.status(200).json({
    service: "Alento API",
    status: "ok",
    now: new Date().toISOString(),
  });
});

router.use("/", authRoutes);
router.use("/auth", authRoutes);
router.use("/", portalUsuarioRoutes);

router.use(requireAuth);
router.use("/", contaRoutes);
router.use("/", acessoPageRoutes);

router.get("/painel", requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO), DashboardController.index);
router.get("/agenda", requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO), AgendaPageController.index);
router.use("/familias", requireRole(PERFIS.ADMIN, PERFIS.ATENDENTE), familiaPageRoutes);

router.use("/admin/usuarios", limiter, usuarioRoutes);
router.use("/usuarios", limiter, usuarioRoutes);
router.use("/api/admin/usuarios", limiter, usuarioRoutes);
router.use("/api/usuarios", limiter, usuarioRoutes);
router.use("/api/familias", limiter, familiaRoutes);

router.use("/", limiter, pacienteRoutes);
router.use("/", limiter, atendimentoRoutes);
router.use("/", limiter, buscaRoutes);
router.use("/", limiter, relatorioRoutes);
router.use("/", limiter, agendaRoutes);
router.use("/api", limiter, pacienteRoutes);
router.use("/api", limiter, atendimentoRoutes);
router.use("/api", limiter, buscaRoutes);
router.use("/api", limiter, relatorioRoutes);
router.use("/api", limiter, agendaRoutes);

module.exports = router;
