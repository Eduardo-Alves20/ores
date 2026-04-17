const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CSP_REPORT_PATH,
  applySecurityHeaders,
} = require("../../middlewares/securityHeaders");

function createMockResponse() {
  const headers = new Map();

  return {
    locals: {},
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test("applySecurityHeaders define os headers basicos de hardening", () => {
  const req = {
    path: "/health",
    protocol: "https",
    get(name) {
      if (String(name || "").toLowerCase() === "host") {
        return "ORES.local";
      }
      return "";
    },
  };
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
  assert.equal(res.getHeader("cross-origin-resource-policy"), "same-site");
  assert.equal(res.getHeader("origin-agent-cluster"), "?1");
  assert.match(String(res.getHeader("permissions-policy") || ""), /camera=\(\)/);
  assert.match(String(res.getHeader("permissions-policy") || ""), /microphone=\(\)/);
  assert.match(String(req.cspNonce || ""), /\S+/);
  assert.equal(typeof res.locals.renderCspNonceAttr, "function");
  assert.equal(res.locals.renderCspNonceAttr(), `nonce="${req.cspNonce}"`);

  const enforcedCsp = String(res.getHeader("content-security-policy") || "");
  const reportOnlyCsp = String(res.getHeader("content-security-policy-report-only") || "");
  const reportTo = String(res.getHeader("report-to") || "");

  assert.equal(
    enforcedCsp.includes(`script-src 'self' 'nonce-${req.cspNonce}'`),
    true
  );
  assert.match(reportOnlyCsp, /strict-dynamic/);
  assert.match(enforcedCsp, /report-uri https:\/\/ORES\.local\/api\/security\/csp-report/);
  assert.match(reportOnlyCsp, /report-to csp-endpoint/);
  assert.match(reportTo, new RegExp(CSP_REPORT_PATH.replace("/", "\\/")));
});
