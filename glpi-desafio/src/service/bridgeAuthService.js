import crypto from "crypto";
import { acharPorUsuarioOuEmail } from "../repos/usuariosRepo.js";

const consumedBridgeTokens = new Map();
const BRIDGE_ISSUER = "alento";
const BRIDGE_TOKEN_VERSION = 1;
const BRIDGE_MAX_TOKEN_TTL_SECONDS = 90;
const BRIDGE_CLOCK_SKEW_SECONDS = 15;
const BRIDGE_ALLOWED_ROLES = new Set(["admin", "usuario"]);

function isProd() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

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

function criarErroBridge(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseBridgeHeader(headerPart) {
  try {
    return JSON.parse(fromBase64Url(headerPart));
  } catch (_) {
    throw criarErroBridge("Cabecalho de bridge invalido.", 401);
  }
}

function parseBridgePayload(payloadPart) {
  try {
    return JSON.parse(fromBase64Url(payloadPart));
  } catch (_) {
    throw criarErroBridge("Payload de bridge invalido.", 401);
  }
}

function normalizeUnixTimestamp(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw criarErroBridge(`${label} de bridge invalido.`, 401);
  }
  return Math.trunc(parsed);
}

function normalizeBridgeRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!BRIDGE_ALLOWED_ROLES.has(normalized)) {
    throw criarErroBridge("Perfil de bridge invalido.", 401);
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
    throw criarErroBridge("Janela temporal de bridge invalida.", 401);
  }

  if (exp - iat > BRIDGE_MAX_TOKEN_TTL_SECONDS) {
    throw criarErroBridge("Token de bridge excede a validade maxima permitida.", 401);
  }

  if (iat > now + BRIDGE_CLOCK_SKEW_SECONDS) {
    throw criarErroBridge("Token de bridge emitido no futuro.", 401);
  }

  if (nbf > now + BRIDGE_CLOCK_SKEW_SECONDS) {
    throw criarErroBridge("Token de bridge ainda nao esta valido.", 401);
  }

  if (exp <= now) {
    throw criarErroBridge("Token de bridge expirado.", 401);
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
    throw criarErroBridge("Token de bridge ja utilizado.", 401);
  }

  consumedBridgeTokens.set(jti, Number(exp) * 1000);
}

export function resolveExpectedBridgeUser(bridgeRole) {
  const role = String(bridgeRole || "").trim().toLowerCase();

  if (role === "admin") {
    return String(
      process.env.HELPDESK_ADMIN_LOGIN ||
        process.env.GLPI_BRIDGE_ADMIN_LOGIN ||
        (!isProd() ? "admin" : "")
    ).trim();
  }

  return String(
    process.env.HELPDESK_USER_LOGIN ||
      process.env.GLPI_BRIDGE_USER_LOGIN ||
      (!isProd() ? "usuario" : "")
  ).trim();
}

export function verifyBridgeToken(
  token,
  { audience = "help-desk", secret = process.env.HELPDESK_BRIDGE_SECRET } = {},
) {
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 3) {
    throw criarErroBridge("Token de bridge invalido.", 401);
  }

  if (!secret) {
    throw criarErroBridge("Bridge desabilitado neste ambiente.", 403);
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
    throw criarErroBridge("Assinatura de bridge invalida.", 401);
  }

  const header = parseBridgeHeader(headerPart);
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    throw criarErroBridge("Cabecalho de bridge nao suportado.", 401);
  }

  const payload = parseBridgePayload(payloadPart);
  if (payload?.iss !== BRIDGE_ISSUER) {
    throw criarErroBridge("Emissor de bridge invalido.", 401);
  }
  if (payload?.aud !== audience) {
    throw criarErroBridge("Destino de bridge invalido.", 401);
  }
  if (!payload?.jti || !payload?.bridgeUser || !payload?.bridgeRole || !payload?.sub) {
    throw criarErroBridge("Claims de bridge incompletas.", 401);
  }
  if (Number(payload?.ver || BRIDGE_TOKEN_VERSION) !== BRIDGE_TOKEN_VERSION) {
    throw criarErroBridge("Versao de bridge nao suportada.", 401);
  }

  const normalizedRole = normalizeBridgeRole(payload.bridgeRole);
  const lifetime = validateBridgeLifetime(payload);
  const sourceUserId = String(payload.sub || "").trim();
  if (!sourceUserId) {
    throw criarErroBridge("Identidade de origem do bridge invalida.", 401);
  }

  const expectedBridgeUser = resolveExpectedBridgeUser(normalizedRole);
  if (!expectedBridgeUser || String(payload.bridgeUser).trim() !== expectedBridgeUser) {
    throw criarErroBridge("Usuario de bridge nao autorizado.", 403);
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

export async function authenticateBridgeToken(token, deps = {}) {
  const payload = verifyBridgeToken(token, deps);
  const findUserByLogin = deps.findUserByLogin || acharPorUsuarioOuEmail;
  const usuario = await findUserByLogin(String(payload.bridgeUser).trim().toLowerCase());

  if (!usuario || String(usuario.usuario || "").trim().toLowerCase() !== String(payload.bridgeUser).trim().toLowerCase()) {
    throw criarErroBridge("Usuario de bridge nao encontrado.", 403);
  }

  if (String(usuario.status || "ativo").trim().toLowerCase() === "bloqueado") {
    throw criarErroBridge("Usuario de bridge bloqueado.", 403);
  }

  const perfilLocal = String(usuario.perfil || "").trim().toLowerCase();
  if (payload.bridgeRole === "admin" && perfilLocal !== "admin") {
    throw criarErroBridge("Usuario local nao corresponde ao perfil administrativo do bridge.", 403);
  }

  if (payload.bridgeRole === "usuario" && perfilLocal !== "usuario") {
    throw criarErroBridge("Usuario local nao corresponde ao perfil padrao do bridge.", 403);
  }

  return { payload, usuario };
}

export function resetConsumedBridgeTokens() {
  consumedBridgeTokens.clear();
}
