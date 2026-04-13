const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  authenticateBridgeToken,
  resetConsumedBridgeTokens,
  verifyBridgeToken,
} = require("../src/services/bridgeAuthService");

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

  const restore = () => {
    Object.keys(overrides).forEach((key) => {
      if (typeof previous[key] === "undefined") delete process.env[key];
      else process.env[key] = previous[key];
    });
  };

  try {
    const result = run();
    if (result && typeof result.then === "function") {
      return result.finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test("verifyBridgeToken aceita token valido e rejeita replay", () => {
  resetConsumedBridgeTokens();

  withEnv(
    {
      AMBIENTE: "LOCAL",
      HDI_BRIDGE_SECRET: "segredo-hdi",
      HDI_USER_LOGIN: "usuario",
    },
    () => {
      const payload = {
        iss: "alento",
        aud: "hdi",
        jti: "bridge-1",
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
        sub: "507f1f77bcf86cd799439011",
      };

      const token = signBridgeToken(process.env.HDI_BRIDGE_SECRET, payload);
      const decoded = verifyBridgeToken(token);

      assert.equal(decoded.bridgeUser, "usuario");
      assert.equal(decoded.sub, "507f1f77bcf86cd799439011");
      assert.throws(() => verifyBridgeToken(token), /ja utilizado/i);
    }
  );
});

test("authenticateBridgeToken exige usuario local correspondente", async () => {
  resetConsumedBridgeTokens();

  await withEnv(
    {
      AMBIENTE: "LOCAL",
      HDI_BRIDGE_SECRET: "segredo-hdi",
      HDI_ADMIN_LOGIN: "admin",
    },
    async () => {
      const payload = {
        iss: "alento",
        aud: "hdi",
        jti: "bridge-2",
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        bridgeUser: "admin",
        bridgeRole: "admin",
        sub: "507f1f77bcf86cd799439012",
      };
      const token = signBridgeToken(process.env.HDI_BRIDGE_SECRET, payload);

      const result = await authenticateBridgeToken(token, {
        userModel: {
          async findOne(query) {
            if (query.username === "admin") {
              return { _id: "1", username: "admin", groups: ["LOCAL_ADMIN"] };
            }
            return null;
          },
        },
      });

      assert.equal(result.user.username, "admin");
      assert.equal(result.payload.bridgeRole, "admin");
    }
  );
});

test("verifyBridgeToken rejeita token com validade longa demais", () => {
  resetConsumedBridgeTokens();

  withEnv(
    {
      AMBIENTE: "LOCAL",
      HDI_BRIDGE_SECRET: "segredo-hdi",
      HDI_USER_LOGIN: "usuario",
    },
    () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: "alento",
        aud: "hdi",
        jti: "bridge-ttl",
        iat: now,
        nbf: now,
        exp: now + 600,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
        sub: "507f1f77bcf86cd799439013",
      };

      const token = signBridgeToken(process.env.HDI_BRIDGE_SECRET, payload);
      assert.throws(() => verifyBridgeToken(token), /validade maxima/i);
    }
  );
});

test("authenticateBridgeToken exige grupo local compativel no ambiente LOCAL", async () => {
  resetConsumedBridgeTokens();

  await withEnv(
    {
      AMBIENTE: "LOCAL",
      HDI_BRIDGE_SECRET: "segredo-hdi",
      HDI_USER_LOGIN: "usuario",
    },
    async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: "alento",
        aud: "hdi",
        jti: "bridge-group-mismatch",
        iat: now,
        nbf: now,
        exp: now + 60,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
        sub: "507f1f77bcf86cd799439014",
      };
      const token = signBridgeToken(process.env.HDI_BRIDGE_SECRET, payload);

      await assert.rejects(
        authenticateBridgeToken(token, {
          userModel: {
            async findOne() {
              return { _id: "1", username: "usuario", groups: ["LOCAL_ADMIN"] };
            },
          },
        }),
        /grupo local compativel/i
      );
    }
  );
});
