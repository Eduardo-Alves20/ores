const crypto = require("crypto");
const User = require("../models/User");

const consumedBridgeTokens = new Map();

function fromBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function toBufferBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function signBridgeMessage(secret, message) {
  return crypto
    .createHmac("sha256", String(secret || ""))
    .update(message)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createBridgeError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanupConsumedBridgeTokens() {
  const now = Date.now();

  for (const [jti, expiresAt] of consumedBridgeTokens.entries()) {
    if (expiresAt <= now) {
      consumedBridgeTokens.delete(jti);
    }
  }
}

function consumeBridgeTokenId(jti, exp) {
  cleanupConsumedBridgeTokens();

  if (consumedBridgeTokens.has(jti)) {
    throw createBridgeError("Token de bridge ja utilizado.", 401);
  }

  consumedBridgeTokens.set(jti, Number(exp) * 1000);
}

function resolveExpectedBridgeUser(bridgeRole) {
  const role = String(bridgeRole || "").trim().toLowerCase();
  const isLocal = String(process.env.AMBIENTE || "").trim().toUpperCase() === "LOCAL";

  if (role === "admin") {
    return String(
      process.env.HDI_ADMIN_LOGIN ||
        process.env.HDI_BRIDGE_ADMIN_LOGIN ||
        (isLocal ? process.env.LOCAL_ADMIN_USERNAME || "admin" : "")
    ).trim();
  }

  return String(
    process.env.HDI_USER_LOGIN ||
      process.env.HDI_BRIDGE_USER_LOGIN ||
      (isLocal ? process.env.LOCAL_USER_USERNAME || "usuario" : "")
  ).trim();
}

function verifyBridgeToken(token, { audience = "hdi", secret = process.env.HDI_BRIDGE_SECRET } = {}) {
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 3) {
    throw createBridgeError("Token de bridge invalido.", 401);
  }

  if (!secret) {
    throw createBridgeError("Bridge desabilitado neste ambiente.", 403);
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const message = `${headerPart}.${payloadPart}`;
  const expectedSignature = signBridgeMessage(secret, message);

  const receivedSignature = toBufferBase64Url(signaturePart);
  const computedSignature = toBufferBase64Url(expectedSignature);
  if (
    receivedSignature.length !== computedSignature.length ||
    !crypto.timingSafeEqual(receivedSignature, computedSignature)
  ) {
    throw createBridgeError("Assinatura de bridge invalida.", 401);
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart));
  } catch (_) {
    throw createBridgeError("Payload de bridge invalido.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.iss !== "alento") {
    throw createBridgeError("Emissor de bridge invalido.", 401);
  }
  if (payload?.aud !== audience) {
    throw createBridgeError("Destino de bridge invalido.", 401);
  }
  if (!payload?.jti || !payload?.exp || !payload?.bridgeUser || !payload?.bridgeRole) {
    throw createBridgeError("Claims de bridge incompletas.", 401);
  }
  if (Number(payload.exp) < now) {
    throw createBridgeError("Token de bridge expirado.", 401);
  }

  const expectedBridgeUser = resolveExpectedBridgeUser(payload.bridgeRole);
  if (!expectedBridgeUser || String(payload.bridgeUser).trim() !== expectedBridgeUser) {
    throw createBridgeError("Usuario de bridge nao autorizado.", 403);
  }

  consumeBridgeTokenId(String(payload.jti), payload.exp);
  return payload;
}

async function authenticateBridgeToken(token, deps = {}) {
  const payload = verifyBridgeToken(token, deps);
  const userModel = deps.userModel || User;
  const user = await userModel.findOne({ username: String(payload.bridgeUser).trim() });

  if (!user) {
    throw createBridgeError("Usuario de bridge nao encontrado.", 403);
  }

  return { payload, user };
}

function resetConsumedBridgeTokens() {
  consumedBridgeTokens.clear();
}

module.exports = {
  authenticateBridgeToken,
  cleanupConsumedBridgeTokens,
  resetConsumedBridgeTokens,
  resolveExpectedBridgeUser,
  verifyBridgeToken,
};
