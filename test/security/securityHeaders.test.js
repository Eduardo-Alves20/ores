const test = require("node:test");
const assert = require("node:assert/strict");

const { applySecurityHeaders } = require("../../middlewares/securityHeaders");

function createMockResponse() {
  const headers = new Map();

  return {
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test("applySecurityHeaders define os headers basicos de hardening", () => {
  const req = { path: "/health" };
  const res = createMockResponse();
  let nextCalled = false;

  applySecurityHeaders(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.getHeader("x-content-type-options"), "nosniff");
  assert.equal(res.getHeader("x-frame-options"), "SAMEORIGIN");
  assert.equal(res.getHeader("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(res.getHeader("x-permitted-cross-domain-policies"), "none");
  assert.equal(res.getHeader("cross-origin-opener-policy"), "same-origin");
  assert.match(String(res.getHeader("permissions-policy") || ""), /camera=\(\)/);
  assert.match(String(res.getHeader("permissions-policy") || ""), /microphone=\(\)/);
});
