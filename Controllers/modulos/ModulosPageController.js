const { PERFIS } = require("../../config/roles");
const { createBridgeToken, resolveBridgeConfig } = require("../../services/security/bridgeTokenService");

const MODULES = Object.freeze({
  "help-desk": {
    slug: "help-desk",
    title: "Help Desk",
    navKey: "modulo-helpdesk",
    icon: "fa-solid fa-headset",
    stageLabel: "Apresentacao",
    formActionEnv: "HELPDESK_URL",
    bridgePath: "/modulos/help-desk/acessar",
    summary:
      "Modulo de atendimento interno para concentrar solicitacoes, suporte operacional e acompanhamento de chamados.",
    currentPhaseItems: [
      "O modulo ja aparece no menu principal do sistema central.",
      "Administradores do GESA entram como administradores do modulo.",
      "Demais usuarios entram como usuario padrao nesta primeira fase.",
    ],
    nextPhaseItems: [
      "Integrar login unico entre sistema central e modulo.",
      "Refinar perfis por funcao, como recepcao, equipe tecnica e voluntariado.",
      "Aplicar regras mais finas de visibilidade por tipo de usuario.",
    ],
  },
  hdi: {
    slug: "hdi",
    title: "HDI",
    navKey: "modulo-hdi",
    icon: "fa-solid fa-diagram-project",
    stageLabel: "Apresentacao",
    formActionEnv: "HDI_URL",
    bridgePath: "/modulos/hdi/acessar",
    summary:
      "Modulo de gestao de demandas internas, acompanhamento visual de atividades e organizacao de quadros.",
    currentPhaseItems: [
      "O modulo ja aparece no menu principal do sistema central.",
      "Administradores do GESA entram como administradores do modulo.",
      "Demais usuarios entram como usuario padrao nesta primeira fase.",
    ],
    nextPhaseItems: [
      "Integrar login unico entre sistema central e modulo.",
      "Conectar papel global do usuario com papeis internos dos quadros.",
      "Evoluir para regras por funcao, area e nivel de acesso.",
    ],
  },
});

function resolveModuleAccess(user = null) {
  const perfil = String(user?.perfil || "").trim().toLowerCase();
  const isAdmin = perfil === PERFIS.ADMIN || perfil === PERFIS.SUPERADMIN;

  return {
    roleKey: isAdmin ? "admin" : "usuario",
    roleLabel: isAdmin ? "Administrador" : "Usuario padrao",
    roleDescription: isAdmin
      ? "Como administrador do sistema central, voce entra neste modulo com perfil administrativo nesta fase da demonstracao."
      : "Nesta fase da demonstracao, usuarios que nao sao administradores entram neste modulo com perfil padrao.",
    badgeLabel: isAdmin ? "Admin" : "Usuario",
  };
}

function resolveLaunchUrl(moduleView) {
  const rawUrl = String(process.env[moduleView.formActionEnv] || "").trim();
  if (!rawUrl) return "";

  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch (_) {
    return "";
  }
}

function resolveBridgeCredentials(moduleView, user = null) {
  return resolveBridgeConfig(moduleView, user);
}

class ModulosPageController {
  static show(req, res, next) {
    const moduleView = MODULES[req.params.slug];

    if (!moduleView) {
      const err = new Error("Modulo nao encontrado.");
      err.status = 404;
      err.publicMessage = "O modulo solicitado nao foi encontrado.";
      return next(err);
    }

    const access = resolveModuleAccess(req?.session?.user || null);
    const launchUrl = resolveLaunchUrl(moduleView);
    const bridgeConfig = resolveBridgeCredentials(moduleView, req?.session?.user || null);
    const isLive = Boolean(launchUrl && bridgeConfig);

    return res.status(200).render("pages/modulos/show", {
      title: moduleView.title,
      sectionTitle: moduleView.title,
      navKey: moduleView.navKey,
      layout: "partials/app.ejs",
      pageClass: "page-modulo-show",
      extraCss: ["/css/modulos.css"],
      moduleView: {
        ...moduleView,
        stageLabel: isLive ? "Sistema real" : moduleView.stageLabel,
        launchUrl,
        isLive,
        bridgeEnabled: isLive,
        access,
      },
    });
  }

  static bridge(req, res, next) {
    const moduleView = MODULES[req.params.slug];

    if (!moduleView) {
      const err = new Error("Modulo nao encontrado.");
      err.status = 404;
      err.publicMessage = "O modulo solicitado nao foi encontrado.";
      return next(err);
    }

    const formAction = resolveLaunchUrl(moduleView);
    const bridge = createBridgeToken({
      moduleView: {
        ...moduleView,
        launchUrl: formAction,
      },
      user: req?.session?.user || null,
    });

    if (!formAction || !bridge) {
      return res.redirect(`/modulos/${moduleView.slug}`);
    }

    return res.status(200).render("pages/modulos/bridge", {
      title: `Acessando ${moduleView.title}`,
      sectionTitle: moduleView.title,
      navKey: moduleView.navKey,
      layout: "partials/app.ejs",
      pageClass: "page-modulo-bridge",
      extraCss: ["/css/modulos.css"],
      moduleView,
      bridge,
    });
  }
}

module.exports = ModulosPageController;
