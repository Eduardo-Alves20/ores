import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import {
  authenticateBridgeToken,
  resetConsumedBridgeTokens,
  verifyBridgeToken,
} from "../src/service/bridgeAuthService.js";

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signBridgeToken(secret, payload) {
  const header = toBase64Url({ alg: "HS256", typ: "JWT" });
  const body = toBase64Url(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${header}.${body}.${signature}`;
}

function withEnv(overrides, run) {
  const previous = {};

  Object.keys(overrides).forEach((key) => {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  });

  try {
    return run();
  } finally {
    Object.keys(overrides).forEach((key) => {
      if (typeof previous[key] === "undefined") delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

test("verifyBridgeToken valida token do help desk e bloqueia replay", () => {
  resetConsumedBridgeTokens();

  withEnv(
    {
      NODE_ENV: "development",
      HELPDESK_BRIDGE_SECRET: "segredo-helpdesk",
      HELPDESK_USER_LOGIN: "usuario",
    },
    () => {
      const payload = {
        iss: "alento",
        aud: "help-desk",
        jti: "helpdesk-1",
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
        sub: "507f1f77bcf86cd799439011",
      };
      const token = signBridgeToken(process.env.HELPDESK_BRIDGE_SECRET, payload);

      const decoded = verifyBridgeToken(token);
      assert.equal(decoded.bridgeUser, "usuario");
      assert.equal(decoded.sub, "507f1f77bcf86cd799439011");
      assert.throws(() => verifyBridgeToken(token), /ja utilizado/i);
    },
  );
});

test("authenticateBridgeToken exige usuario-ponte existente", async () => {
  resetConsumedBridgeTokens();

  await withEnv(
    {
      NODE_ENV: "development",
      HELPDESK_BRIDGE_SECRET: "segredo-helpdesk",
      HELPDESK_ADMIN_LOGIN: "admin",
    },
    async () => {
      const payload = {
        iss: "alento",
        aud: "help-desk",
        jti: "helpdesk-2",
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        bridgeUser: "admin",
        bridgeRole: "admin",
        sub: "507f1f77bcf86cd799439012",
      };
      const token = signBridgeToken(process.env.HELPDESK_BRIDGE_SECRET, payload);

      const result = await authenticateBridgeToken(token, {
        findUserByLogin: async () => ({
          _id: "1",
          usuario: "admin",
          perfil: "admin",
          status: "ativo",
        }),
      });

      assert.equal(result.usuario.usuario, "admin");
      assert.equal(result.payload.bridgeRole, "admin");
    },
  );
});

test("verifyBridgeToken rejeita token com validade longa demais", () => {
  withEnv(
    {
      NODE_ENV: "development",
      HELPDESK_BRIDGE_SECRET: "segredo-helpdesk",
      HELPDESK_USER_LOGIN: "usuario",
    },
    () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: "alento",
        aud: "help-desk",
        jti: "helpdesk-ttl",
        iat: now,
        nbf: now,
        exp: now + 600,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
        sub: "507f1f77bcf86cd799439013",
      };
      const token = signBridgeToken(process.env.HELPDESK_BRIDGE_SECRET, payload);

      assert.throws(() => verifyBridgeToken(token), /validade maxima/i);
    },
  );
});

test("authenticateBridgeToken rejeita usuario local com perfil diferente do bridge", async () => {
  await withEnv(
    {
      NODE_ENV: "development",
      HELPDESK_BRIDGE_SECRET: "segredo-helpdesk",
      HELPDESK_USER_LOGIN: "usuario",
    },
    async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: "alento",
        aud: "help-desk",
        jti: "helpdesk-role-mismatch",
        iat: now,
        nbf: now,
        exp: now + 60,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
        sub: "507f1f77bcf86cd799439014",
      };
      const token = signBridgeToken(process.env.HELPDESK_BRIDGE_SECRET, payload);

      await assert.rejects(
        authenticateBridgeToken(token, {
          findUserByLogin: async () => ({
            _id: "1",
            usuario: "usuario",
            perfil: "admin",
            status: "ativo",
          }),
        }),
        /perfil padrao/i,
      );
    },
  );
});
