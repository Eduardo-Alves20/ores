const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  THROTTLE_STATE,
  createAdaptiveThrottleGuard,
  isAdaptiveThrottleBlocked,
  registerAdaptiveThrottleFailure,
  registerAdaptiveThrottleSuccess,
  resolveAdaptiveThrottleKey,
} = require("../../services/security/adaptiveThrottleService");

function createRequest(overrides = {}) {
  return {
    body: { identificador: "usuario@alento.local" },
    headers: {},
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/login",
    session: {},
    ...overrides,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    payload: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("adaptive throttle bloqueia chave apos exceder limiar de falhas", () => {
  THROTTLE_STATE.clear();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "alento-adaptive-throttle-"));
  const previousLogPath = process.env.SECURITY_EVENT_LOG_PATH;
  process.env.SECURITY_EVENT_LOG_PATH = path.join(tempDir, "security-events.log");

  const guard = createAdaptiveThrottleGuard({
    scope: "auth.login",
    threshold: 2,
    windowMs: 60_000,
    blockMs: 60_000,
    message: "bloqueado",
  });

  const req = createRequest();
  const res = createResponse();
  let nextCalls = 0;

  guard(req, res, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  registerAdaptiveThrottleFailure(req, { threshold: 2, windowMs: 60_000, blockMs: 60_000 });
  registerAdaptiveThrottleFailure(req, { threshold: 2, windowMs: 60_000, blockMs: 60_000 });

  const blockedReq = createRequest();
  const blockedRes = createResponse();
  guard(blockedReq, blockedRes, () => {
    nextCalls += 1;
  });

  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.payload, "bloqueado");
  assert.equal(isAdaptiveThrottleBlocked(blockedReq.adaptiveThrottleContext.key), true);

  if (typeof previousLogPath === "undefined") {
    delete process.env.SECURITY_EVENT_LOG_PATH;
  } else {
    process.env.SECURITY_EVENT_LOG_PATH = previousLogPath;
  }
});

test("registerAdaptiveThrottleSuccess reduz contador de falhas", () => {
  THROTTLE_STATE.clear();

  const req = createRequest();
  req.adaptiveThrottleContext = {
    key: resolveAdaptiveThrottleKey(req, "auth.login"),
    scope: "auth.login",
    threshold: 4,
    windowMs: 60_000,
    blockMs: 60_000,
  };

  registerAdaptiveThrottleFailure(req, { threshold: 4, windowMs: 60_000, blockMs: 60_000 });
  registerAdaptiveThrottleFailure(req, { threshold: 4, windowMs: 60_000, blockMs: 60_000 });

  const stateBefore = THROTTLE_STATE.get(req.adaptiveThrottleContext.key);
  assert.equal(stateBefore.failures >= 2, true);

  registerAdaptiveThrottleSuccess(req);

  const stateAfter = THROTTLE_STATE.get(req.adaptiveThrottleContext.key);
  assert.equal(stateAfter.failures <= stateBefore.failures, true);
});
