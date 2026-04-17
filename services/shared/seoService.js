const { isProdLike } = require("../../config/env");

const SITE_NAME = "GESA";
const SITE_DISPLAY_NAME = "GESA | Fundacao ORES";
const ORGANIZATION_NAME = "Fundacao ORES";
const DEFAULT_LOCALE = "pt_BR";
const DEFAULT_TYPE = "website";
const DEFAULT_THEME_COLOR = "#b24a32";
const DEFAULT_IMAGE_PATH = "/assets/og-default.svg";
const DEFAULT_IMAGE_ALT =
  "Identidade visual do GESA, sistema de gestao social da Fundacao ORES.";
const DEFAULT_DESCRIPTION =
  "Sistema web de gestao social da Fundacao ORES para familias, voluntarios, atendimentos e agenda.";

const INDEXABLE_PUBLIC_PATHS = new Set(["/login", "/cadastro"]);
const PRIVATE_DISALLOW_PATHS = [
  "/agenda",
  "/painel",
  "/familias",
  "/perfil",
  "/notificacoes",
  "/meus-dados",
  "/minha-familia",
  "/administracao",
  "/acessos",
  "/seguranca",
  "/modulos",
  "/api",
  "/auth",
  "/uploads",
  "/me",
  "/health",
];

const SITEMAP_ENTRIES = [
  {
    path: "/login",
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    path: "/cadastro",
    changefreq: "monthly",
    priority: "0.8",
  },
];

function normalizePath(pathname = "/") {
  const raw = String(pathname || "/").trim();
  if (!raw) return "/";
  const withoutQuery = raw.split("?")[0].split("#")[0] || "/";
  if (withoutQuery === "/") return "/";
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

function stripTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function sanitizeText(value, fallback = "") {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function resolveSiteUrl(req) {
  const envUrl = [
    process.env.SITE_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
  ]
    .map((value) => String(value || "").trim())
    .find((value) => /^https?:\/\//i.test(value));

  if (envUrl) {
    return stripTrailingSlash(envUrl);
  }

  const protocol =
    String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim() ||
    req?.protocol ||
    "https";
  const host = String(req?.get?.("host") || req?.headers?.host || "").trim();

  if (!host) {
    return "http://localhost:4000";
  }

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function buildAbsoluteUrl(req, pathOrUrl = "/") {
  const rawValue = String(pathOrUrl || "").trim();
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  const pathname = normalizePath(rawValue || "/");
  return `${resolveSiteUrl(req)}${pathname}`;
}

function isPublicIndexablePath(pathname = "/") {
  return INDEXABLE_PUBLIC_PATHS.has(normalizePath(pathname));
}

function shouldNoindex(pathname = "/", explicitValue) {
  if (typeof explicitValue === "boolean") {
    return explicitValue;
  }

  if (!isProdLike) {
    return true;
  }

  return !isPublicIndexablePath(pathname);
}

function normalizeTitle(title) {
  const cleanTitle = sanitizeText(title);
  if (!cleanTitle) return SITE_DISPLAY_NAME;

  const lowerTitle = cleanTitle.toLowerCase();
  if (lowerTitle.includes("gesa") || lowerTitle.includes("ORES")) {
    return cleanTitle;
  }

  return `${cleanTitle} | ${SITE_NAME}`;
}

function resolveDefaultDescription(pathname, title, noindex) {
  if (pathname === "/login") {
    return "Acesse o GESA, sistema de gestao social da Fundacao ORES para familias, voluntarios, atendimentos e agenda institucional.";
  }

  if (pathname === "/cadastro") {
    return "Crie seu acesso ao GESA para acompanhar dados, atendimentos e fluxos da Fundacao ORES como familia ou voluntario.";
  }

  if (noindex) {
    const shortTitle = sanitizeText(title).replace(/\s+\|\s+GESA$/i, "");
    if (shortTitle) {
      return `${shortTitle} na area interna do GESA, sistema de gestao social da Fundacao ORES.`;
    }
  }

  return DEFAULT_DESCRIPTION;
}

function normalizeSchemas(schemas) {
  if (!schemas) return [];
  return Array.isArray(schemas) ? schemas.filter(Boolean) : [schemas];
}

function buildPublicSchemas(req) {
  const siteUrl = resolveSiteUrl(req);

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: ORGANIZATION_NAME,
      url: siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: "Sistema de Gestao da Fundacao ORES",
      url: siteUrl,
      inLanguage: "pt-BR",
      publisher: {
        "@type": "Organization",
        name: ORGANIZATION_NAME,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      inLanguage: "pt-BR",
      description: DEFAULT_DESCRIPTION,
      publisher: {
        "@type": "Organization",
        name: ORGANIZATION_NAME,
      },
    },
  ];
}

function buildSeo(req, overrides = {}) {
  const pathname = normalizePath(overrides.canonicalPath || req?.path || "/");
  const noindex = shouldNoindex(pathname, overrides.noindex);
  const title = normalizeTitle(overrides.title);
  const description = sanitizeText(
    overrides.description,
    resolveDefaultDescription(pathname, title, noindex)
  );
  const schemas = noindex
    ? normalizeSchemas(overrides.schemas)
    : [
        ...buildPublicSchemas(req),
        ...normalizeSchemas(overrides.schemas),
      ];

  return {
    title,
    description,
    canonicalUrl: buildAbsoluteUrl(req, pathname),
    imageUrl: buildAbsoluteUrl(req, overrides.imagePath || DEFAULT_IMAGE_PATH),
    imageAlt: sanitizeText(overrides.imageAlt, DEFAULT_IMAGE_ALT),
    robots: noindex
      ? "noindex, nofollow, noarchive"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    locale: DEFAULT_LOCALE,
    type: sanitizeText(overrides.type, DEFAULT_TYPE),
    siteName: SITE_DISPLAY_NAME,
    themeColor: sanitizeText(overrides.themeColor, DEFAULT_THEME_COLOR),
    noindex,
    schemas,
  };
}

function buildSitemapXml(req) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = SITEMAP_ENTRIES.map((entry) => {
    const loc = buildAbsoluteUrl(req, entry.path);
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}

function buildRobotsTxt(req) {
  const lines = [
    "User-agent: *",
    "Allow: /login",
    "Allow: /cadastro",
  ];

  PRIVATE_DISALLOW_PATHS.forEach((path) => {
    lines.push(`Disallow: ${path}`);
  });

  lines.push(`Sitemap: ${buildAbsoluteUrl(req, "/sitemap.xml")}`);
  return lines.join("\n");
}

module.exports = {
  buildSeo,
  buildSitemapXml,
  buildRobotsTxt,
};
