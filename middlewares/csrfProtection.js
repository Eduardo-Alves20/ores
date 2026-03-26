const crypto = require("crypto");
const { CSP_REPORT_PATH } = require("./securityHeaders");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);
const CSRF_FIELD_NAME = "_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const FALLBACK_HEADER_NAMES = [CSRF_HEADER_NAME, "x-xsrf-token", "csrf-token"];
const CSRF_EXEMPT_PATHS = new Set([CSP_REPORT_PATH]);

function wantsHtml(req) {
  return typeof req?.accepts === "function" && !!req.accepts("html");
}

function isSafeMethod(method) {
  return SAFE_METHODS.has(String(method || "").trim().toUpperCase());
}

function resolveRequestPath(req) {
  const rawPath = String(req?.path || req?.originalUrl || req?.url || "").trim();
  if (!rawPath) return "";
  return rawPath.split("?")[0];
}

function isCsrfExemptRequest(req) {
  const requestPath = resolveRequestPath(req);
  return CSRF_EXEMPT_PATHS.has(requestPath);
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function shouldIssueCsrfToken(req) {
  if (!req?.session) return false;
  if (req.session.user) return true;
  return wantsHtml(req);
}

function getOrCreateCsrfToken(req) {
  if (!req?.session) return "";
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  return String(req.session.csrfToken || "");
}

function resolveCsrfTokenFromRequest(req) {
  const body = req?.body && typeof req.body === "object" ? req.body : null;
  if (body && typeof body[CSRF_FIELD_NAME] !== "undefined") {
    return String(body[CSRF_FIELD_NAME] || "");
  }

  const headers = req?.headers || {};
  for (const headerName of FALLBACK_HEADER_NAMES) {
    if (typeof headers[headerName] !== "undefined") {
      return String(headers[headerName] || "");
    }
  }

  if (typeof req?.get === "function") {
    for (const headerName of FALLBACK_HEADER_NAMES) {
      const value = req.get(headerName);
      if (typeof value !== "undefined") {
        return String(value || "");
      }
    }
  }

  return "";
}

function tokensMatch(expected, received) {
  const expectedToken = String(expected || "");
  const receivedToken = String(received || "");

  if (!expectedToken || !receivedToken) return false;

  const expectedBuffer = Buffer.from(expectedToken, "utf8");
  const receivedBuffer = Buffer.from(receivedToken, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function renderCsrfField(token) {
  if (!token) return "";
  return `<input type="hidden" name="${CSRF_FIELD_NAME}" value="${token}" />`;
}

function attachCsrfLocals(req, res) {
  const token = req?.session?.csrfToken
    ? String(req.session.csrfToken || "")
    : shouldIssueCsrfToken(req)
      ? getOrCreateCsrfToken(req)
      : "";

  req.csrfToken = token;
  res.locals.csrfToken = token;
  res.locals.csrfFieldName = CSRF_FIELD_NAME;
  res.locals.csrfHeaderName = "X-CSRF-Token";
  res.locals.renderCsrfField = () => renderCsrfField(token);

  return token;
}

function createCsrfError() {
  const error = new Error("Falha na verificacao de seguranca da requisicao.");
  error.status = 403;
  error.code = "CSRF_VALIDATION_FAILED";
  error.publicMessage = "Falha na verificacao de seguranca da requisicao.";
  return error;
}

function csrfProtection(req, res, next) {
  const expectedToken = attachCsrfLocals(req, res);

  if (isSafeMethod(req?.method) || isCsrfExemptRequest(req)) {
    return next();
  }

  if (!tokensMatch(expectedToken, resolveCsrfTokenFromRequest(req))) {
    return next(createCsrfError());
  }

  return next();
}

module.exports = {
  CSRF_FIELD_NAME,
  CSRF_HEADER_NAME,
  attachCsrfLocals,
  createCsrfError,
  csrfProtection,
  generateCsrfToken,
  getOrCreateCsrfToken,
  isSafeMethod,
  renderCsrfField,
  resolveCsrfTokenFromRequest,
  shouldIssueCsrfToken,
  tokensMatch,
  wantsHtml,
  CSRF_EXEMPT_PATHS,
  isCsrfExemptRequest,
  resolveRequestPath,
};
