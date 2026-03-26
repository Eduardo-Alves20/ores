const crypto = require("crypto");

const CSP_REPORT_PATH = "/api/security/csp-report";

function normalizeBooleanEnv(value, fallback = false) {
  if (typeof value === "undefined" || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "sim", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "nao", "off"].includes(normalized)) return false;
  return fallback;
}

function resolveCspConfiguration() {
  return {
    enforce: normalizeBooleanEnv(process.env.CSP_ENFORCE, true),
    reportOnly: normalizeBooleanEnv(process.env.CSP_REPORT_ONLY, true),
  };
}

function generateCspNonce() {
  return crypto.randomBytes(16).toString("base64");
}

function renderCspNonceAttr(nonce) {
  if (!nonce) return "";
  return `nonce="${nonce}"`;
}

function resolveAbsolutePathUrl(req, pathname) {
  const safePath = String(pathname || "").trim() || "/";
  const host = String(req?.get?.("host") || "").trim();
  if (!host) return safePath;

  const protocol = String(req?.protocol || "").trim().toLowerCase() || "https";
  return `${protocol}://${host}${safePath}`;
}

function joinDirective(name, values) {
  return `${name} ${values.join(" ")}`;
}

function buildCspDirectives({ nonce, reportEndpoint, strict }) {
  const scriptSrcValues = strict
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https://cdn.jsdelivr.net"]
    : ["'self'", `'nonce-${nonce}'`, "https://cdn.jsdelivr.net"];

  const styleSrcValues = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
  ];

  const directives = [
    joinDirective("default-src", ["'self'"]),
    joinDirective("script-src", scriptSrcValues),
    joinDirective("style-src", styleSrcValues),
    joinDirective("img-src", ["'self'", "data:", "blob:", "https:"]),
    joinDirective("font-src", [
      "'self'",
      "data:",
      "https://fonts.gstatic.com",
      "https://cdnjs.cloudflare.com",
    ]),
    joinDirective("connect-src", ["'self'"]),
    joinDirective("frame-src", ["'self'"]),
    joinDirective("object-src", ["'none'"]),
    joinDirective("base-uri", ["'self'"]),
    joinDirective("form-action", ["'self'"]),
    joinDirective("frame-ancestors", ["'self'"]),
    joinDirective("manifest-src", ["'self'"]),
    joinDirective("report-uri", [reportEndpoint]),
    joinDirective("report-to", ["csp-endpoint"]),
  ];

  if (strict) {
    directives.push("require-trusted-types-for 'script'");
  }

  return directives.join("; ");
}

function buildReportToHeader(reportEndpoint) {
  return JSON.stringify({
    group: "csp-endpoint",
    max_age: 10886400,
    endpoints: [{ url: reportEndpoint }],
  });
}

function applySecurityHeaders(req, res, next) {
  const cspConfig = resolveCspConfiguration();
  const nonce = generateCspNonce();
  const reportEndpoint = resolveAbsolutePathUrl(req, CSP_REPORT_PATH);

  req.cspNonce = nonce;
  res.locals.cspNonce = nonce;
  res.locals.renderCspNonceAttr = () => renderCspNonceAttr(nonce);

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()"
  );
  res.setHeader("Report-To", buildReportToHeader(reportEndpoint));

  if (cspConfig.enforce) {
    res.setHeader(
      "Content-Security-Policy",
      buildCspDirectives({ nonce, reportEndpoint, strict: false })
    );
  }

  if (cspConfig.reportOnly) {
    res.setHeader(
      "Content-Security-Policy-Report-Only",
      buildCspDirectives({ nonce, reportEndpoint, strict: true })
    );
  }

  next();
}

module.exports = {
  CSP_REPORT_PATH,
  applySecurityHeaders,
  buildCspDirectives,
  buildReportToHeader,
  generateCspNonce,
  renderCspNonceAttr,
  resolveCspConfiguration,
};
