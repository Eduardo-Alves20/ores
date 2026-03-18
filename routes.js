const express = require("express");
const rateLimit = require("express-rate-limit");
const requestIp = require("request-ip");

const authRoutes = require("./Routes/auth/authRoutes");
const usuarioRoutes = require("./Routes/admin/usuarioRoutes");
const familiaRoutes = require("./Routes/familia/familiaRoutes");
const pacienteRoutes = require("./Routes/familia/pacienteRoutes");
const atendimentoRoutes = require("./Routes/familia/atendimentoRoutes");
const buscaRoutes = require("./Routes/shared/buscaRoutes");
const relatorioRoutes = require("./Routes/shared/relatorioRoutes");
const familiaPageRoutes = require("./Routes/familia/familiaPageRoutes");
const agendaRoutes = require("./Routes/agenda/agendaRoutes");
const portalUsuarioRoutes = require("./Routes/portal/portalUsuarioRoutes");
const contaRoutes = require("./Routes/conta/contaRoutes");
const acessoPageRoutes = require("./Routes/admin/acessoPageRoutes");
const segurancaRoutes = require("./Routes/admin/segurancaRoutes");
const administracaoRoutes = require("./Routes/admin/administracaoRoutes");
const modulosRoutes = require("./Routes/modulos/modulosRoutes");
const DashboardController = require("./Controllers/admin/DashboardController");
const AgendaPageController = require("./Controllers/agenda/AgendaPageController");
const AgendaPresencaPageController = require("./Controllers/agenda/AgendaPresencaPageController");
const { PERFIS } = require("./config/roles");
const { PERMISSIONS } = require("./config/permissions");
const { buildRobotsTxt, buildSitemapXml } = require("./services/seoService");

const { requireAuth, requirePermission } = require("./middlewares/authSession");

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
      if (String(req.session.user.tipoCadastro || "").toLowerCase() === "familia") {
        return res.redirect("/minha-familia");
      }
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

router.get("/robots.txt", (req, res) => {
  return res.type("text/plain").send(buildRobotsTxt(req));
});

router.get("/sitemap.xml", (req, res) => {
  return res.type("application/xml").send(buildSitemapXml(req));
});

router.get("/auth", (req, res) => {
  return res.redirect(301, "/login");
});

router.get("/auth/login", (req, res) => {
  return res.redirect(301, "/login");
});

router.get("/auth/cadastro", (req, res) => {
  return res.redirect(301, "/cadastro");
});

router.use("/", authRoutes);
router.use("/auth", authRoutes);
router.use("/", portalUsuarioRoutes);
router.use("/", modulosRoutes);

router.use(requireAuth);
router.use("/", contaRoutes);
router.use("/", acessoPageRoutes);
router.use("/", segurancaRoutes);
router.use("/", administracaoRoutes);

router.get("/painel", requirePermission(PERMISSIONS.DASHBOARD_VIEW), DashboardController.index);
router.get("/agenda", requirePermission(PERMISSIONS.AGENDA_VIEW), AgendaPageController.index);
router.get(
  "/agenda/presencas",
  requirePermission(PERMISSIONS.AGENDA_VIEW),
  AgendaPresencaPageController.index
);
router.get(
  "/agenda/presencas/analise/:section",
  requirePermission(PERMISSIONS.AGENDA_VIEW),
  AgendaPresencaPageController.detail
);
router.use("/familias", requirePermission(PERMISSIONS.FAMILIAS_VIEW), familiaPageRoutes);

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
