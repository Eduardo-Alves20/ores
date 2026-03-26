const requestIp = require("request-ip");
const { logSecurityEvent } = require("./securityEventService");

const THROTTLE_STATE = new Map();
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_BLOCK_MS = 15 * 60 * 1000;
const DEFAULT_THRESHOLD = 8;

function normalizeKeyPart(value, maxLength = 120) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w.@+\-:|]/g, "_")
    .slice(0, maxLength);
}

function resolveAdaptiveThrottleKey(req, scope = "global") {
  const ip = normalizeKeyPart(requestIp.getClientIp(req) || req?.ip || "unknown-ip");
  const identifier = normalizeKeyPart(
    req?.body?.identificador ||
      req?.body?.email ||
      req?.body?.login ||
      req?.session?.user?.email ||
      req?.session?.user?.id ||
      "",
    180
  );

  return `${normalizeKeyPart(scope, 64)}|${ip}|${identifier || "anonymous"}`;
}

function resolveThrottleState(key, now, windowMs) {
  const current = THROTTLE_STATE.get(key);
  if (!current) {
    const freshState = {
      failures: 0,
      firstFailureAt: now,
      lastFailureAt: 0,
      blockedUntil: 0,
    };
    THROTTLE_STATE.set(key, freshState);
    return freshState;
  }

  if (current.firstFailureAt && now - current.firstFailureAt > windowMs) {
    current.failures = 0;
    current.firstFailureAt = now;
    current.lastFailureAt = 0;
  }

  return current;
}

function cleanupThrottleState(now = Date.now()) {
  if (THROTTLE_STATE.size < 2000) return;

  for (const [key, state] of THROTTLE_STATE.entries()) {
    const shouldDelete =
      !state ||
      (state.blockedUntil && state.blockedUntil < now && state.failures <= 0) ||
      (!state.blockedUntil && state.lastFailureAt && now - state.lastFailureAt > DEFAULT_WINDOW_MS * 3);

    if (shouldDelete) {
      THROTTLE_STATE.delete(key);
    }
  }
}

function isAdaptiveThrottleBlocked(key, now = Date.now()) {
  const state = THROTTLE_STATE.get(String(key || ""));
  if (!state?.blockedUntil) return false;
  return now < state.blockedUntil;
}

function registerAdaptiveThrottleFailure(req, options = {}) {
  const key = String(req?.adaptiveThrottleContext?.key || "").trim();
  if (!key) return null;

  const now = Date.now();
  const threshold = Number(options.threshold || req?.adaptiveThrottleContext?.threshold || DEFAULT_THRESHOLD);
  const windowMs = Number(options.windowMs || req?.adaptiveThrottleContext?.windowMs || DEFAULT_WINDOW_MS);
  const blockMs = Number(options.blockMs || req?.adaptiveThrottleContext?.blockMs || DEFAULT_BLOCK_MS);
  const state = resolveThrottleState(key, now, windowMs);

  state.failures += 1;
  state.lastFailureAt = now;

  if (state.failures >= threshold) {
    state.blockedUntil = now + blockMs;
    logSecurityEvent({
      type: "ADAPTIVE_THROTTLE_BLOCK",
      severity: "warning",
      actorId: req?.session?.user?.id || null,
      ip:
        req?.headers?.["x-forwarded-for"] ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        "",
      method: req?.method || "",
      route: req?.originalUrl || req?.url || "",
      userAgent: req?.get?.("user-agent") || "",
      payload: {
        failures: state.failures,
        scope: req?.adaptiveThrottleContext?.scope || "global",
        threshold,
        blockedUntil: new Date(state.blockedUntil).toISOString(),
      },
    });
  }

  cleanupThrottleState(now);
  return state;
}

function registerAdaptiveThrottleSuccess(req) {
  const key = String(req?.adaptiveThrottleContext?.key || "").trim();
  if (!key) return null;

  const state = THROTTLE_STATE.get(key);
  if (!state) return null;

  state.failures = Math.max(0, Number(state.failures || 0) - 2);
  if (state.failures === 0) {
    state.blockedUntil = 0;
  }

  return state;
}

function createAdaptiveThrottleGuard(options = {}) {
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  const blockMs = Number(options.blockMs || DEFAULT_BLOCK_MS);
  const threshold = Number(options.threshold || DEFAULT_THRESHOLD);
  const scope = String(options.scope || "global");
  const message =
    String(options.message || "").trim() ||
    "Muitas tentativas consecutivas detectadas. Aguarde alguns minutos antes de tentar novamente.";

  return function adaptiveThrottleGuard(req, res, next) {
    const key = resolveAdaptiveThrottleKey(req, scope);
    req.adaptiveThrottleContext = {
      blockMs,
      key,
      scope,
      threshold,
      windowMs,
    };

    if (isAdaptiveThrottleBlocked(key)) {
      return res.status(429).send(message);
    }

    return next();
  };
}

module.exports = {
  DEFAULT_BLOCK_MS,
  DEFAULT_THRESHOLD,
  DEFAULT_WINDOW_MS,
  THROTTLE_STATE,
  createAdaptiveThrottleGuard,
  isAdaptiveThrottleBlocked,
  registerAdaptiveThrottleFailure,
  registerAdaptiveThrottleSuccess,
  resolveAdaptiveThrottleKey,
};
