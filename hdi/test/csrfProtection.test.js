const test = require("node:test");
const assert = require("node:assert/strict");

const {
  attachCsrfLocals,
  csrfProtection,
} = require("../src/middlewares/csrfProtection");

function createRequest(overrides = {}) {
  return {
    method: "GET",
    headers: {},
    session: {},
    accepts(type) {
      return type === "html" ? "html" : false;
    },
    get(headerName) {
      return this.headers[String(headerName || "").toLowerCase()];
    },
    ...overrides,
  };
}

function createResponse() {
  return {
    locals: {},
  };
}

test("attachCsrfLocals emite token para HTML com sessao", () => {
  const req = createRequest();
  const res = createResponse();

  const token = attachCsrfLocals(req, res);

  assert.ok(token);
  assert.equal(token, req.session.csrfToken);
  assert.equal(res.locals.csrfToken, token);
});

test("csrfProtection rejeita POST sem token", async () => {
  const req = createRequest({
    method: "POST",
    session: { csrfToken: "segredo" },
  });
  const res = createResponse();

  await new Promise((resolve) => {
    csrfProtection(req, res, (error) => {
      assert.equal(error?.status, 403);
      assert.match(error?.message || "", /seguranca/i);
      resolve();
    });
  });
});

test("csrfProtection aceita POST com header valido", async () => {
  const req = createRequest({
    method: "POST",
    headers: { "x-csrf-token": "segredo" },
    session: { csrfToken: "segredo" },
  });
  const res = createResponse();

  await new Promise((resolve, reject) => {
    csrfProtection(req, res, (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
});
