const crypto = require("crypto");
const User = require("../models/User");

const consumedBridgeTokens = new Map();
const BRIDGE_ISSUER = "alento";
const BRIDGE_TOKEN_VERSION = 1;
const BRIDGE_MAX_TOKEN_TTL_SECONDS = 90;
const BRIDGE_CLOCK_SKEW_SECONDS = 15;
const BRIDGE_ALLOWED_ROLES = new Set(["admin", "usuario"]);

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

function parseBridgeHeader(headerPart) {
  try {
    return JSON.parse(fromBase64Url(headerPart));
  } catch (_) {
    throw createBridgeError("Cabecalho de bridge invalido.", 401);
  }
}

function parseBridgePayload(payloadPart) {
  try {
    return JSON.parse(fromBase64Url(payloadPart));
  } catch (_) {
    throw createBridgeError("Payload de bridge invalido.", 401);
  }
}

function normalizeUnixTimestamp(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createBridgeError(`${label} de bridge invalido.`, 401);
  }
  return Math.trunc(parsed);
}

function normalizeBridgeRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!BRIDGE_ALLOWED_ROLES.has(normalized)) {
    throw createBridgeError("Perfil de bridge invalido.", 401);
  }
  return normalized;
}

function normalizeBridgeSource(source = {}) {
  const permissions = Array.isArray(source?.permissions)
    ? Array.from(
        new Set(
          source.permissions
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        )
      ).slice(0, 64)
    : [];

  const authVersion = Number(source?.authVersion);

  return {
    authVersion:
      Number.isFinite(authVersion) && authVersion >= 0 ? Math.trunc(authVersion) : 0,
    email: String(source?.email || "").trim().toLowerCase(),
    nivelAcessoVoluntario: String(source?.nivelAcessoVoluntario || "")
      .trim()
      .toLowerCase(),
    perfil: String(source?.perfil || "").trim().toLowerCase(),
    permissions,
    tipoCadastro: String(source?.tipoCadastro || "").trim().toLowerCase(),
  };
}

function validateBridgeLifetime(payload) {
  const now = Math.floor(Date.now() / 1000);
  const iat = normalizeUnixTimestamp(payload?.iat, "IAT");
  const exp = normalizeUnixTimestamp(payload?.exp, "EXP");
  const nbf =
    typeof payload?.nbf === "undefined"
      ? iat
      : normalizeUnixTimestamp(payload?.nbf, "NBF");

  if (exp <= iat) {
    throw createBridgeError("Janela temporal de bridge invalida.", 401);
  }

  if (exp - iat > BRIDGE_MAX_TOKEN_TTL_SECONDS) {
    throw createBridgeError("Token de bridge excede a validade maxima permitida.", 401);
  }

  if (iat > now + BRIDGE_CLOCK_SKEW_SECONDS) {
    throw createBridgeError("Token de bridge emitido no futuro.", 401);
  }

  if (nbf > now + BRIDGE_CLOCK_SKEW_SECONDS) {
    throw createBridgeError("Token de bridge ainda nao esta valido.", 401);
  }

  if (exp <= now) {
    throw createBridgeError("Token de bridge expirado.", 401);
  }

  return { exp, iat, nbf };
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

function hasExpectedLocalGroup(user, bridgeRole) {
  const isLocal = String(process.env.AMBIENTE || "").trim().toUpperCase() === "LOCAL";
  if (!isLocal) return true;

  const groups = Array.isArray(user?.groups)
    ? user.groups.map((item) => String(item || "").trim().toUpperCase())
    : [];
  const expectedGroup = bridgeRole === "admin" ? "LOCAL_ADMIN" : "LOCAL_USER";
  return groups.includes(expectedGroup);
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

  const header = parseBridgeHeader(headerPart);
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    throw createBridgeError("Cabecalho de bridge nao suportado.", 401);
  }

  const payload = parseBridgePayload(payloadPart);
  if (payload?.iss !== BRIDGE_ISSUER) {
    throw createBridgeError("Emissor de bridge invalido.", 401);
  }
  if (payload?.aud !== audience) {
    throw createBridgeError("Destino de bridge invalido.", 401);
  }
  if (!payload?.jti || !payload?.bridgeUser || !payload?.bridgeRole || !payload?.sub) {
    throw createBridgeError("Claims de bridge incompletas.", 401);
  }
  if (Number(payload?.ver || BRIDGE_TOKEN_VERSION) !== BRIDGE_TOKEN_VERSION) {
    throw createBridgeError("Versao de bridge nao suportada.", 401);
  }

  const normalizedRole = normalizeBridgeRole(payload.bridgeRole);
  const lifetime = validateBridgeLifetime(payload);
  const sourceUserId = String(payload.sub || "").trim();
  if (!sourceUserId) {
    throw createBridgeError("Identidade de origem do bridge invalida.", 401);
  }

  const expectedBridgeUser = resolveExpectedBridgeUser(normalizedRole);
  if (!expectedBridgeUser || String(payload.bridgeUser).trim() !== expectedBridgeUser) {
    throw createBridgeError("Usuario de bridge nao autorizado.", 403);
  }

  consumeBridgeTokenId(String(payload.jti), lifetime.exp);
  return {
    ...payload,
    bridgeRole: normalizedRole,
    exp: lifetime.exp,
    iat: lifetime.iat,
    nbf: lifetime.nbf,
    src: normalizeBridgeSource(payload.src),
    sub: sourceUserId,
    ver: BRIDGE_TOKEN_VERSION,
  };
}

async function authenticateBridgeToken(token, deps = {}) {
  const payload = verifyBridgeToken(token, deps);
  const userModel = deps.userModel || User;
  const user = await userModel.findOne({ username: String(payload.bridgeUser).trim() });

  if (!user) {
    throw createBridgeError("Usuario de bridge nao encontrado.", 403);
  }

  if (!hasExpectedLocalGroup(user, payload.bridgeRole)) {
    throw createBridgeError("Usuario de bridge sem grupo local compativel.", 403);
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
