const test = require("node:test");
const assert = require("node:assert/strict");

const ModulosPageController = require("../../Controllers/modulos/ModulosPageController");

function createMockResponse() {
  return {
    statusCode: 200,
    rendered: null,
    redirectUrl: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    render(view, payload) {
      this.rendered = { view, payload };
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
  };
}

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

test("show desabilita bridge quando URL externa e insegura", () => {
  withEnv(
    {
      HELPDESK_URL: "javascript:alert(1)",
      HELPDESK_USER_LOGIN: "usuario",
      HELPDESK_BRIDGE_SECRET: "segredo",
    },
    () => {
      const req = {
        params: { slug: "help-desk" },
        session: { user: { perfil: "usuario" } },
      };
      const res = createMockResponse();

      ModulosPageController.show(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.rendered.payload.moduleView.launchUrl, "");
      assert.equal(res.rendered.payload.moduleView.bridgeEnabled, false);
      assert.equal(res.rendered.payload.moduleView.isLive, false);
    }
  );
});

test("show exige credenciais do perfil atual para liberar acesso automatico", () => {
  withEnv(
    {
      HELPDESK_URL: "https://helpdesk.exemplo.com/login",
      HELPDESK_USER_LOGIN: undefined,
      HELPDESK_BRIDGE_SECRET: undefined,
    },
    () => {
      const req = {
        params: { slug: "help-desk" },
        session: { user: { perfil: "usuario" } },
      };
      const res = createMockResponse();

      ModulosPageController.show(req, res, () => {});

      assert.equal(res.rendered.payload.moduleView.launchUrl, "https://helpdesk.exemplo.com/login");
      assert.equal(res.rendered.payload.moduleView.bridgeEnabled, false);
      assert.equal(res.rendered.payload.moduleView.isLive, false);
    }
  );
});

test("bridge redireciona para a tela do modulo quando bridge seguro nao existe", () => {
  withEnv(
    {
      HELPDESK_URL: "https://helpdesk.exemplo.com/login",
      HELPDESK_USER_LOGIN: undefined,
      HELPDESK_BRIDGE_SECRET: undefined,
    },
    () => {
      const req = {
        params: { slug: "help-desk" },
        session: { user: { perfil: "usuario" } },
      };
      const res = createMockResponse();

      ModulosPageController.bridge(req, res, () => {});

      assert.equal(res.redirectUrl, "/modulos/help-desk");
    }
  );
});

test("bridge renderiza token assinado em vez de credenciais em claro", () => {
  withEnv(
    {
      HELPDESK_URL: "https://helpdesk.exemplo.com/login",
      HELPDESK_USER_LOGIN: "usuario",
      HELPDESK_BRIDGE_SECRET: "segredo-super-forte",
    },
    () => {
      const req = {
        params: { slug: "help-desk" },
        session: { user: { id: "507f1f77bcf86cd799439011", perfil: "usuario" } },
      };
      const res = createMockResponse();

      ModulosPageController.bridge(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(typeof res.rendered.payload.bridge.token, "string");
      assert.match(res.rendered.payload.bridge.bridgeEndpoint, /^https:\/\/helpdesk\.exemplo\.com\/bridge\/sso$/);
      assert.equal("username" in res.rendered.payload.bridge, false);
      assert.equal("password" in res.rendered.payload.bridge, false);
    }
  );
});
