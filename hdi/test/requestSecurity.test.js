const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NO_STORE_CACHE_CONTROL,
  applyDynamicNoStoreHeaders,
  applySecurityHeaders,
} = require("../src/middlewares/requestSecurity");

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

test("applySecurityHeaders define hardening basico", async () => {
  const res = createResponse();

  await new Promise((resolve, reject) => {
    applySecurityHeaders({}, res, (error) => (error ? reject(error) : resolve()));
  });

  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "SAMEORIGIN");
  assert.equal(res.headers["Cross-Origin-Opener-Policy"], "same-origin");
});

test("applyDynamicNoStoreHeaders marca resposta autenticada como sem cache", async () => {
  const res = createResponse();
  const req = { session: { user: { _id: "1" } } };

  await new Promise((resolve, reject) => {
    applyDynamicNoStoreHeaders(req, res, (error) => (error ? reject(error) : resolve()));
  });

  assert.equal(res.headers["Cache-Control"], NO_STORE_CACHE_CONTROL);
  assert.equal(res.headers["Pragma"], "no-cache");
  assert.equal(res.headers["Vary"], "Cookie");
});
