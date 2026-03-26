const test = require("node:test");
const assert = require("node:assert/strict");

const { createAttachCurrentUser } = require("../../middlewares/authSession");

function createMockResponse() {
  return {
    locals: {},
    clearedCookies: [],
    redirectUrl: "",
    statusCode: 200,
    body: null,
    clearCookie(name) {
      this.clearedCookies.push(name);
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("attachCurrentUser invalida sessao HTML quando authVersion diverge", async () => {
  let destroyed = false;
  const req = {
    session: {
      user: {
        id: "507f1f77bcf86cd799439011",
        perfil: "usuario",
        tipoCadastro: "familia",
        nivelAcessoVoluntario: "",
        authVersion: 1,
        permissions: ["portal.minha-familia"],
      },
      destroy(callback) {
        destroyed = true;
        callback();
      },
    },
    accepts(format) {
      return format === "html";
    },
  };
  const res = createMockResponse();
  let nextArg = "not-called";

  const attachCurrentUser = createAttachCurrentUser({
    loadSessionValidationSnapshot: async () => ({
      ativo: true,
      perfil: "usuario",
      tipoCadastro: "familia",
      nivelAcessoVoluntario: "",
      statusAprovacao: "aprovado",
      authVersion: 2,
    }),
  });

  await attachCurrentUser(req, res, (arg) => {
    nextArg = arg;
  });

  assert.equal(destroyed, true);
  assert.equal(res.redirectUrl, "/login?reason=sessao_revogada");
  assert.deepEqual(res.clearedCookies.sort(), ["alento.sid", "connect.sid"]);
  assert.equal(nextArg, "not-called");
});

test("attachCurrentUser atualiza sessao valida e recarrega permissoes quando faltam", async () => {
  const req = {
    session: {
      user: {
        id: "507f1f77bcf86cd799439011",
        nome: "Antigo",
        email: "OLD@EXEMPLO.COM",
        perfil: "usuario",
        tipoCadastro: "familia",
        nivelAcessoVoluntario: "",
        authVersion: 4,
        permissions: [],
      },
    },
    accepts() {
      return false;
    },
  };
  const res = createMockResponse();
  let permissionRefreshCount = 0;
  let nextArg = null;

  const attachCurrentUser = createAttachCurrentUser({
    loadSessionValidationSnapshot: async () => ({
      nome: "Atualizada",
      email: "nova@exemplo.com",
      ativo: true,
      perfil: "usuario",
      tipoCadastro: "familia",
      nivelAcessoVoluntario: "",
      statusAprovacao: "aprovado",
      authVersion: 4,
    }),
    resolvePermissionsFromSession: async (request) => {
      permissionRefreshCount += 1;
      request.session.user.permissions = ["portal.minha-familia"];
      return request.session.user.permissions;
    },
  });

  await attachCurrentUser(req, res, (arg) => {
    nextArg = arg;
  });

  assert.equal(nextArg, undefined);
  assert.equal(permissionRefreshCount, 1);
  assert.equal(req.session.user.nome, "Atualizada");
  assert.equal(req.session.user.email, "nova@exemplo.com");
  assert.deepEqual(req.currentUser.permissions, ["portal.minha-familia"]);
  assert.equal(res.locals.currentUser, req.currentUser);
});
