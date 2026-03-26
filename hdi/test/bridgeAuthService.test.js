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

  try {
    return run();
  } finally {
    Object.keys(overrides).forEach((key) => {
      if (typeof previous[key] === "undefined") delete process.env[key];
      else process.env[key] = previous[key];
    });
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
        exp: Math.floor(Date.now() / 1000) + 60,
        bridgeUser: "usuario",
        bridgeRole: "usuario",
      };

      const token = signBridgeToken(process.env.HDI_BRIDGE_SECRET, payload);
      const decoded = verifyBridgeToken(token);

      assert.equal(decoded.bridgeUser, "usuario");
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
        exp: Math.floor(Date.now() / 1000) + 60,
        bridgeUser: "admin",
        bridgeRole: "admin",
      };
      const token = signBridgeToken(process.env.HDI_BRIDGE_SECRET, payload);

      const result = await authenticateBridgeToken(token, {
        userModel: {
          async findOne(query) {
            if (query.username === "admin") {
              return { _id: "1", username: "admin" };
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
