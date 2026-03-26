const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);
const CSRF_FIELD_NAME = "_csrf";
const FALLBACK_HEADER_NAMES = ["x-csrf-token", "x-xsrf-token", "csrf-token"];

function wantsHtml(req) {
  return typeof req?.accepts === "function" && !!req.accepts("html");
}

function isSafeMethod(method) {
  return SAFE_METHODS.has(String(method || "").trim().toUpperCase());
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

function attachCsrfLocals(req, res) {
  const token =
    req?.session?.csrfToken || shouldIssueCsrfToken(req)
      ? getOrCreateCsrfToken(req)
      : "";

  req.csrfToken = token;
  res.locals.csrfToken = token;
  res.locals.csrfFieldName = CSRF_FIELD_NAME;
  res.locals.csrfHeaderName = "X-CSRF-Token";
  res.locals.renderCsrfField = () =>
    token ? `<input type="hidden" name="${CSRF_FIELD_NAME}" value="${token}" />` : "";

  return token;
}

function resolveCsrfTokenFromRequest(req) {
  const body = req?.body && typeof req.body === "object" ? req.body : null;
  if (body && typeof body[CSRF_FIELD_NAME] !== "undefined") {
    return String(body[CSRF_FIELD_NAME] || "");
  }

  for (const headerName of FALLBACK_HEADER_NAMES) {
    const headerValue =
      typeof req?.get === "function" ? req.get(headerName) : req?.headers?.[headerName];
    if (typeof headerValue !== "undefined") {
      return String(headerValue || "");
    }
  }

  return "";
}

function tokensMatch(expected, received) {
  const left = Buffer.from(String(expected || ""), "utf8");
  const right = Buffer.from(String(received || ""), "utf8");
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createCsrfError() {
  const error = new Error("Falha na verificacao de seguranca da requisicao.");
  error.status = 403;
  error.code = "CSRF_VALIDATION_FAILED";
  return error;
}

function csrfProtection(req, res, next) {
  const expectedToken = attachCsrfLocals(req, res);

  if (isSafeMethod(req?.method)) {
    return next();
  }

  if (!tokensMatch(expectedToken, resolveCsrfTokenFromRequest(req))) {
    return next(createCsrfError());
  }

  return next();
}

module.exports = {
  CSRF_FIELD_NAME,
  attachCsrfLocals,
  createCsrfError,
  csrfProtection,
  generateCsrfToken,
  getOrCreateCsrfToken,
  isSafeMethod,
  resolveCsrfTokenFromRequest,
  tokensMatch,
};
