const test = require("node:test");
const assert = require("node:assert/strict");

const { PERFIS } = require("../../config/roles");
const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../../services/domain/UsuarioService");
const {
  changeManagedUserStatus,
  updateManagedUser,
} = require("../../services/admin/user/userActionService");

const ACTOR_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f191e810c19729de860ea";

test("UsuarioService.buscarPorId rejeita id invalido sem consultar o banco", async () => {
  const originalFindById = Usuario.findById;
  let findCalled = false;

  Usuario.findById = () => {
    findCalled = true;
    return {
      select() {
        return null;
      },
    };
  };

  try {
    await assert.rejects(
      () => UsuarioService.buscarPorId("usuario-invalido"),
      (error) =>
        error?.status === 400 &&
        error?.message === "Identificador de usuario invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    Usuario.findById = originalFindById;
  }
});

test("changeManagedUserStatus rejeita ativo invalido antes de atualizar o usuario", async () => {
  const originalFindByIdAndUpdate = Usuario.findByIdAndUpdate;
  let updateCalled = false;

  Usuario.findByIdAndUpdate = () => {
    updateCalled = true;
    return {
      select() {
        return null;
      },
    };
  };

  try {
    await assert.rejects(
      () =>
        changeManagedUserStatus({
          id: USER_ID,
          body: { ativo: "talvez" },
          actorContext: { usuarioId: ACTOR_ID },
          currentProfile: PERFIS.ADMIN,
        }),
      (error) =>
        error?.status === 400 &&
        error?.message === "Campo ativo invalido."
    );

    assert.equal(updateCalled, false);
  } finally {
    Usuario.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("updateManagedUser impede admin de promover usuario para superadmin", async () => {
  const originalAtualizar = UsuarioService.atualizar;
  let updateCalled = false;

  UsuarioService.atualizar = async () => {
    updateCalled = true;
    return null;
  };

  try {
    await assert.rejects(
      () =>
        updateManagedUser({
          id: USER_ID,
          body: { perfil: PERFIS.SUPERADMIN },
          actorContext: { usuarioId: ACTOR_ID },
          currentProfile: PERFIS.ADMIN,
        }),
      (error) =>
        error?.status === 403 &&
        error?.message === "Somente superadmin pode promover um usuario para superadmin."
    );

    assert.equal(updateCalled, false);
  } finally {
    UsuarioService.atualizar = originalAtualizar;
  }
});
