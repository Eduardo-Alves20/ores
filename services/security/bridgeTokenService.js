const crypto = require("crypto");

const { normalizePermissionList } = require("../../config/permissions");
const { isAdminProfile } = require("../../config/roles");

const BRIDGE_TOKEN_ISSUER = "alento";
const BRIDGE_TOKEN_TTL_SECONDS = 60;
const BRIDGE_TOKEN_VERSION = 1;
const BRIDGE_MAX_PERMISSION_CLAIMS = 64;

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signMessage(secret, message) {
  return crypto
    .createHmac("sha256", String(secret || ""))
    .update(message)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function resolveModulePrefix(moduleView) {
  const slug = String(moduleView?.slug || "").trim().toLowerCase();
  if (slug === "help-desk") return "HELPDESK";
  if (slug === "hdi") return "HDI";
  return "";
}

function resolveBridgeRole(user = null) {
  return isAdminProfile(user?.perfil) ? "admin" : "usuario";
}

function normalizeBridgeAuthVersion(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function buildBridgeSourceContext(user = null) {
  if (!user || typeof user !== "object") {
    return {
      authVersion: 0,
      permissions: [],
    };
  }

  return {
    authVersion: normalizeBridgeAuthVersion(user.authVersion),
    email: String(user.email || "").trim().toLowerCase(),
    nivelAcessoVoluntario: String(user.nivelAcessoVoluntario || "").trim().toLowerCase(),
    perfil: String(user.perfil || "").trim().toLowerCase(),
    permissions: normalizePermissionList(user.permissions || []).slice(
      0,
      BRIDGE_MAX_PERMISSION_CLAIMS
    ),
    tipoCadastro: String(user.tipoCadastro || "").trim().toLowerCase(),
  };
}

function resolveBridgeConfig(moduleView, user = null) {
  const launchUrl = String(moduleView?.launchUrl || "").trim();
  if (!launchUrl) return null;

  const modulePrefix = resolveModulePrefix(moduleView);
  if (!modulePrefix) return null;

  const bridgeRole = resolveBridgeRole(user);
  const rolePrefix = bridgeRole === "admin" ? "ADMIN" : "USER";
  const bridgeUser = String(process.env[`${modulePrefix}_${rolePrefix}_LOGIN`] || "").trim();
  const bridgeSecret = String(process.env[`${modulePrefix}_BRIDGE_SECRET`] || "").trim();

  if (!bridgeUser || !bridgeSecret) {
    return null;
  }

  let bridgeEndpoint = "";
  try {
    bridgeEndpoint = new URL("/bridge/sso", launchUrl).toString();
  } catch (_) {
    return null;
  }

  return {
    bridgeEndpoint,
    bridgeRole,
    bridgeSecret,
    bridgeUser,
    roleLabel: bridgeRole === "admin" ? "Administrador" : "Usuario padrao",
  };
}

function createBridgeToken({ moduleView, user }) {
  const config = resolveBridgeConfig(moduleView, user);
  if (!config) return null;

  const sourceUserId = String(user?.id || user?._id || "").trim();
  if (!sourceUserId) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    aud: String(moduleView?.slug || ""),
    bridgeRole: config.bridgeRole,
    bridgeUser: config.bridgeUser,
    exp: issuedAt + BRIDGE_TOKEN_TTL_SECONDS,
    iat: issuedAt,
    iss: BRIDGE_TOKEN_ISSUER,
    jti: crypto.randomUUID(),
    nbf: issuedAt,
    src: buildBridgeSourceContext(user),
    sub: sourceUserId,
    ver: BRIDGE_TOKEN_VERSION,
  };

  const encodedHeader = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signMessage(
    config.bridgeSecret,
    `${encodedHeader}.${encodedPayload}`
  );

  return {
    bridgeEndpoint: config.bridgeEndpoint,
    roleLabel: config.roleLabel,
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
  };
}

module.exports = {
  BRIDGE_TOKEN_ISSUER,
  BRIDGE_TOKEN_TTL_SECONDS,
  BRIDGE_TOKEN_VERSION,
  buildBridgeSourceContext,
  createBridgeToken,
  resolveBridgeConfig,
  resolveBridgeRole,
  resolveModulePrefix,
};
