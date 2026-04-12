const test = require("node:test");
const assert = require("node:assert/strict");

const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../../services/domain/UsuarioService");
const AcessoPageController = require("../../Controllers/admin/AcessoPageController");
const {
  canReviewSensitiveApprovalData,
} = require("../../services/admin/access/accessPermissionService");
const {
  approveUserAccess,
  changeUserAccessStatus,
} = require("../../services/admin/access/accessActionService");

const ACTOR_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f191e810c19729de860ea";

function createJsonResponseMock() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test("approveUserAccess rejeita ativo invalido sem atualizar o cadastro", async () => {
  const originalFindById = Usuario.findById;
  const originalAtualizar = UsuarioService.atualizar;
  let updateCalled = false;

  Usuario.findById = () => ({
    select() {
      return {
        lean: async () => ({
          _id: USER_ID,
          nome: "Voluntario",
          perfil: "atendente",
          tipoCadastro: "voluntario",
          statusAprovacao: "pendente",
          votosAprovacao: [],
          nivelAcessoVoluntario: "voluntario_atendimento",
        }),
      };
    },
  });
  UsuarioService.atualizar = async () => {
    updateCalled = true;
    return null;
  };

  try {
    await assert.rejects(
      () =>
        approveUserAccess({
          id: USER_ID,
          actorId: ACTOR_ID,
          body: { ativo: "talvez" },
        }),
      (error) =>
        error?.status === 400 &&
        error?.message === "Campo ativo invalido."
    );

    assert.equal(updateCalled, false);
  } finally {
    Usuario.findById = originalFindById;
    UsuarioService.atualizar = originalAtualizar;
  }
});

test("changeUserAccessStatus rejeita id invalido antes de consultar o usuario", async () => {
  const originalFindById = Usuario.findById;
  let findCalled = false;

  Usuario.findById = () => {
    findCalled = true;
    return {
      select() {
        return {
          lean: async () => null,
        };
      },
    };
  };

  try {
    await assert.rejects(
      () =>
        changeUserAccessStatus({
          req: { session: { user: { perfil: "admin" } } },
          id: "usuario-invalido",
          actorId: ACTOR_ID,
          ativo: true,
        }),
      (error) =>
        error?.status === 400 &&
        error?.message === "Usuario invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    Usuario.findById = originalFindById;
  }
});

test("AcessoPageController.detalhe retorna 400 para id invalido", async () => {
  const req = {
    params: { id: "usuario-invalido" },
    session: { user: { id: ACTOR_ID } },
  };
  const res = createJsonResponseMock();

  await AcessoPageController.detalhe(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    erro: "Usuario invalido.",
  });
});

test("canReviewSensitiveApprovalData libera assistencia social e bloqueia tecnico sem permissao", () => {
  assert.equal(
    canReviewSensitiveApprovalData({
      session: {
        user: {
          perfil: "atendente",
          permissions: [],
        },
      },
    }),
    true
  );

  assert.equal(
    canReviewSensitiveApprovalData({
      session: {
        user: {
          perfil: "tecnico",
          permissions: [],
        },
      },
    }),
    false
  );
});
