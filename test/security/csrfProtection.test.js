const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CSRF_FIELD_NAME,
  attachCsrfLocals,
  createCsrfError,
  csrfProtection,
  getOrCreateCsrfToken,
  isCsrfExemptRequest,
  isSafeMethod,
  resolveRequestPath,
  resolveCsrfTokenFromRequest,
  shouldIssueCsrfToken,
  tokensMatch,
} = require("../../middlewares/csrfProtection");

function createMockResponse() {
  return {
    locals: {},
  };
}

test("isSafeMethod reconhece metodos seguros", () => {
  assert.equal(isSafeMethod("GET"), true);
  assert.equal(isSafeMethod("head"), true);
  assert.equal(isSafeMethod("POST"), false);
  assert.equal(isSafeMethod("PATCH"), false);
});

test("shouldIssueCsrfToken emite token para HTML e sessao autenticada", () => {
  const htmlReq = {
    session: {},
    accepts(format) {
      return format === "html";
    },
  };
  const apiReq = {
    session: {},
    accepts() {
      return false;
    },
  };
  const authReq = {
    session: { user: { id: "1" } },
    accepts() {
      return false;
    },
  };

  assert.equal(shouldIssueCsrfToken(htmlReq), true);
  assert.equal(shouldIssueCsrfToken(apiReq), false);
  assert.equal(shouldIssueCsrfToken(authReq), true);
});

test("attachCsrfLocals anexa token e helper de campo hidden", () => {
  const req = {
    session: {},
    accepts(format) {
      return format === "html";
    },
  };
  const res = createMockResponse();

  const token = attachCsrfLocals(req, res);

  assert.equal(typeof token, "string");
  assert.ok(token.length > 10);
  assert.equal(req.csrfToken, token);
  assert.equal(res.locals.csrfToken, token);
  assert.match(res.locals.renderCsrfField(), new RegExp(`name="${CSRF_FIELD_NAME}"`));
  assert.match(res.locals.renderCsrfField(), new RegExp(`value="${token}"`));
});

test("resolveCsrfTokenFromRequest le corpo e header", () => {
  const fromBody = resolveCsrfTokenFromRequest({
    body: { _csrf: "abc123" },
    headers: {},
  });
  const fromHeader = resolveCsrfTokenFromRequest({
    body: {},
    headers: { "x-csrf-token": "def456" },
  });

  assert.equal(fromBody, "abc123");
  assert.equal(fromHeader, "def456");
});

test("tokensMatch compara token com seguranca", () => {
  assert.equal(tokensMatch("token-a", "token-a"), true);
  assert.equal(tokensMatch("token-a", "token-b"), false);
  assert.equal(tokensMatch("", "token-b"), false);
});

test("csrfProtection permite GET e nao cria token em API GET anonima", () => {
  const req = {
    method: "GET",
    session: {},
    accepts() {
      return false;
    },
  };
  const res = createMockResponse();
  let nextArg = null;

  csrfProtection(req, res, (arg) => {
    nextArg = arg;
  });

  assert.equal(nextArg, undefined);
  assert.equal(req.session.csrfToken, undefined);
  assert.equal(res.locals.csrfToken, "");
});

test("csrfProtection bloqueia POST sem token valido", () => {
  const req = {
    method: "POST",
    session: { csrfToken: "token-seguro" },
    body: {},
    headers: {},
    accepts() {
      return false;
    },
  };
  const res = createMockResponse();
  let nextArg = null;

  csrfProtection(req, res, (arg) => {
    nextArg = arg;
  });

  assert.equal(nextArg?.code, "CSRF_VALIDATION_FAILED");
  assert.equal(nextArg?.status, 403);
});

test("csrfProtection ignora endpoint de relatorio CSP sem abrir outras rotas", () => {
  const req = {
    method: "POST",
    path: "/api/security/csp-report",
    originalUrl: "/api/security/csp-report",
    session: {},
    body: { "csp-report": { "violated-directive": "script-src" } },
    headers: {},
    accepts() {
      return false;
    },
  };
  const res = createMockResponse();
  let nextArg = null;

  csrfProtection(req, res, (arg) => {
    nextArg = arg;
  });

  assert.equal(nextArg, undefined);
  assert.equal(isCsrfExemptRequest(req), true);
  assert.equal(resolveRequestPath(req), "/api/security/csp-report");
});

test("csrfProtection permite POST com token no corpo ou header", () => {
  const bodyReq = {
    method: "POST",
    session: { csrfToken: "token-seguro" },
    body: { _csrf: "token-seguro" },
    headers: {},
    accepts() {
      return false;
    },
  };
  const headerReq = {
    method: "PATCH",
    session: { csrfToken: "token-header" },
    body: {},
    headers: { "x-csrf-token": "token-header" },
    accepts() {
      return false;
    },
  };
  const bodyRes = createMockResponse();
  const headerRes = createMockResponse();
  const calls = [];

  csrfProtection(bodyReq, bodyRes, (arg) => {
    calls.push(arg);
  });
  csrfProtection(headerReq, headerRes, (arg) => {
    calls.push(arg);
  });

  assert.deepEqual(calls, [undefined, undefined]);
});

test("createCsrfError padroniza erro 403", () => {
  const error = createCsrfError();

  assert.equal(error.status, 403);
  assert.equal(error.code, "CSRF_VALIDATION_FAILED");
  assert.equal(error.publicMessage, "Falha na verificacao de seguranca da requisicao.");
});

test("getOrCreateCsrfToken reaproveita token existente", () => {
  const req = { session: {} };
  const first = getOrCreateCsrfToken(req);
  const second = getOrCreateCsrfToken(req);

  assert.equal(first, second);
  assert.ok(first.length > 10);
});
