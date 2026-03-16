const { PERFIS } = require("../../config/roles");

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
  return String(process.env[moduleView.formActionEnv] || "").trim();
}

function resolveBridgeCredentials(moduleView, user = null) {
  const isAdmin = ["admin", "superadmin"].includes(
    String(user?.perfil || "").trim().toLowerCase()
  );
  const modulePrefix = moduleView.slug === "help-desk" ? "HELPDESK" : "HDI";
  const rolePrefix = isAdmin ? "ADMIN" : "USER";

  return {
    roleLabel: isAdmin ? "Administrador" : "Usuario padrao",
    username: String(
      process.env[`${modulePrefix}_${rolePrefix}_LOGIN`] ||
        (isAdmin ? "admin" : "usuario")
    ).trim(),
    password: String(
      process.env[`${modulePrefix}_${rolePrefix}_PASSWORD`] ||
        (isAdmin
          ? moduleView.slug === "help-desk"
            ? "admin123"
            : "123"
          : "123")
    ).trim(),
  };
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
    const isLive = Boolean(launchUrl);

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
    if (!formAction) {
      return res.redirect(`/modulos/${moduleView.slug}`);
    }

    const bridgeCredentials = resolveBridgeCredentials(moduleView, req?.session?.user || null);

    return res.status(200).render("pages/modulos/bridge", {
      title: `Acessando ${moduleView.title}`,
      sectionTitle: moduleView.title,
      navKey: moduleView.navKey,
      layout: "partials/app.ejs",
      pageClass: "page-modulo-bridge",
      extraCss: ["/css/modulos.css"],
      moduleView,
      bridge: {
        formAction,
        username: bridgeCredentials.username,
        password: bridgeCredentials.password,
        roleLabel: bridgeCredentials.roleLabel,
      },
    });
  }
}

module.exports = ModulosPageController;
