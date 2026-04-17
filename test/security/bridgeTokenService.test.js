const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BRIDGE_TOKEN_ISSUER,
  BRIDGE_TOKEN_TTL_SECONDS,
  BRIDGE_TOKEN_VERSION,
  createBridgeToken,
  resolveBridgeConfig,
} = require("../../services/security/bridgeTokenService");

function withEnv(overrides, run) {
  const previous = {};

  Object.keys(overrides).forEach((key) => {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  try {
    return run();
  } finally {
    Object.keys(overrides).forEach((key) => {
      if (typeof previous[key] === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  }
}

function decodePayload(token) {
  const parts = String(token || "").split(".");
  const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(payload);
}

test("resolveBridgeConfig monta endpoint seguro quando login e secret estao configurados", () => {
  withEnv(
    {
      HELPDESK_URL: "https://helpdesk.exemplo.com/auth",
      HELPDESK_USER_LOGIN: "usuario",
      HELPDESK_BRIDGE_SECRET: "segredo",
    },
    () => {
      const config = resolveBridgeConfig(
        {
          slug: "help-desk",
          launchUrl: process.env.HELPDESK_URL,
        },
        { perfil: "usuario" }
      );

      assert.equal(config.bridgeEndpoint, "https://helpdesk.exemplo.com/bridge/sso");
      assert.equal(config.bridgeUser, "usuario");
      assert.equal(config.bridgeRole, "usuario");
    }
  );
});

test("createBridgeToken assina token curto com claims minimas", () => {
  withEnv(
    {
      HDI_URL: "https://hdi.exemplo.com/login",
      HDI_ADMIN_LOGIN: "admin",
      HDI_BRIDGE_SECRET: "segredo-ponte",
    },
    () => {
      const bridge = createBridgeToken({
        moduleView: {
          slug: "hdi",
          launchUrl: process.env.HDI_URL,
        },
        user: {
          id: "507f1f77bcf86cd799439011",
          authVersion: 2,
          email: "ADMIN@ORES.LOCAL",
          perfil: "admin",
          permissions: ["dashboard.view", "agenda.view", "agenda.view"],
          tipoCadastro: "Voluntario",
        },
      });

      const payload = decodePayload(bridge.token);

      assert.equal(bridge.bridgeEndpoint, "https://hdi.exemplo.com/bridge/sso");
      assert.equal(payload.iss, BRIDGE_TOKEN_ISSUER);
      assert.equal(payload.aud, "hdi");
      assert.equal(payload.ver, BRIDGE_TOKEN_VERSION);
      assert.equal(payload.bridgeRole, "admin");
      assert.equal(payload.bridgeUser, "admin");
      assert.equal(payload.nbf, payload.iat);
      assert.equal(payload.sub, "507f1f77bcf86cd799439011");
      assert.deepEqual(payload.src, {
        authVersion: 2,
        email: "admin@ORES.local",
        nivelAcessoVoluntario: "",
        perfil: "admin",
        permissions: ["dashboard.view", "agenda.view"],
        tipoCadastro: "voluntario",
      });
      assert.ok(payload.exp - payload.iat <= BRIDGE_TOKEN_TTL_SECONDS);
    }
  );
});

test("createBridgeToken falha fechado quando a sessao nao possui identificador valido", () => {
  withEnv(
    {
      HELPDESK_URL: "https://helpdesk.exemplo.com/login",
      HELPDESK_USER_LOGIN: "usuario",
      HELPDESK_BRIDGE_SECRET: "segredo",
    },
    () => {
      const bridge = createBridgeToken({
        moduleView: {
          slug: "help-desk",
          launchUrl: process.env.HELPDESK_URL,
        },
        user: {
          perfil: "usuario",
          permissions: ["portal.meus_dados"],
        },
      });

      assert.equal(bridge, null);
    }
  );
});
