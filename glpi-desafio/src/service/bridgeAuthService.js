import crypto from "crypto";
import { acharPorUsuarioOuEmail } from "../repos/usuariosRepo.js";

const consumedBridgeTokens = new Map();

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

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart));
  } catch (_) {
    throw criarErroBridge("Payload de bridge invalido.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.iss !== "alento") {
    throw criarErroBridge("Emissor de bridge invalido.", 401);
  }
  if (payload?.aud !== audience) {
    throw criarErroBridge("Destino de bridge invalido.", 401);
  }
  if (!payload?.jti || !payload?.exp || !payload?.bridgeUser || !payload?.bridgeRole) {
    throw criarErroBridge("Claims de bridge incompletas.", 401);
  }
  if (Number(payload.exp) < now) {
    throw criarErroBridge("Token de bridge expirado.", 401);
  }

  const expectedBridgeUser = resolveExpectedBridgeUser(payload.bridgeRole);
  if (!expectedBridgeUser || String(payload.bridgeUser).trim() !== expectedBridgeUser) {
    throw criarErroBridge("Usuario de bridge nao autorizado.", 403);
  }

  consumeBridgeTokenId(String(payload.jti), payload.exp);
  return payload;
}

export async function authenticateBridgeToken(token, deps = {}) {
  const payload = verifyBridgeToken(token, deps);
  const findUserByLogin = deps.findUserByLogin || acharPorUsuarioOuEmail;
  const usuario = await findUserByLogin(String(payload.bridgeUser).trim().toLowerCase());

  if (!usuario || String(usuario.usuario || "").trim().toLowerCase() !== String(payload.bridgeUser).trim().toLowerCase()) {
    throw criarErroBridge("Usuario de bridge nao encontrado.", 403);
  }

  return { payload, usuario };
}

export function resetConsumedBridgeTokens() {
  consumedBridgeTokens.clear();
}
