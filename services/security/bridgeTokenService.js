const crypto = require("crypto");

const BRIDGE_TOKEN_TTL_SECONDS = 60;

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
  return moduleView?.slug === "help-desk" ? "HELPDESK" : "HDI";
}

function resolveBridgeRole(user = null) {
  const perfil = String(user?.perfil || "").trim().toLowerCase();
  return ["admin", "superadmin"].includes(perfil) ? "admin" : "usuario";
}

function resolveBridgeConfig(moduleView, user = null) {
  const launchUrl = String(moduleView?.launchUrl || "").trim();
  if (!launchUrl) return null;

  const modulePrefix = resolveModulePrefix(moduleView);
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

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    aud: String(moduleView?.slug || ""),
    bridgeRole: config.bridgeRole,
    bridgeUser: config.bridgeUser,
    exp: issuedAt + BRIDGE_TOKEN_TTL_SECONDS,
    iat: issuedAt,
    iss: "alento",
    jti: crypto.randomUUID(),
    sub: String(user?.id || ""),
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
  BRIDGE_TOKEN_TTL_SECONDS,
  createBridgeToken,
  resolveBridgeConfig,
  resolveBridgeRole,
  resolveModulePrefix,
};
