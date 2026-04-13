const test = require("node:test");
const assert = require("node:assert/strict");

const { PERFIS } = require("../../config/roles");
const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../../services/domain/UsuarioService");
const {
  changeManagedUserStatus,
  createManagedUser,
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

test("createManagedUser encaminha dados extras do voluntario para o UsuarioService", async () => {
  const originalCriar = UsuarioService.criar;
  let capturedPayload = null;

  UsuarioService.criar = async (payload) => {
    capturedPayload = payload;
    return {
      _id: USER_ID,
      nome: payload?.nome || "Voluntario Teste",
    };
  };

  try {
    await createManagedUser({
      body: {
        nome: "Voluntario Teste",
        email: "voluntario@alento.test",
        login: "voluntario.teste",
        senha: "SenhaSegura123!",
        perfil: PERFIS.USUARIO,
        tipoCadastro: "voluntario",
        nivelAcessoVoluntario: "operacional",
        camposExtras: {
          disponibilidade_expandida: "Segunda e quarta a tarde",
        },
        dadosCadastro: {
          area_atuacao: "Educacao inclusiva",
          disponibilidade: "Tardes de segunda e quarta",
        },
        anexosProtegidos: {
          documentoIdentidade: {
            assetId: "asset-documento",
            kind: "documentoIdentidade",
            originalName: "rg.pdf",
          },
          fotoPerfil: {
            assetId: "asset-foto",
            kind: "fotoPerfil",
            originalName: "perfil.webp",
          },
        },
      },
      actorContext: { usuarioId: ACTOR_ID },
      currentProfile: PERFIS.ADMIN,
    });

    assert.deepEqual(capturedPayload?.dadosCadastro, {
      area_atuacao: "Educacao inclusiva",
      disponibilidade: "Tardes de segunda e quarta",
    });
    assert.deepEqual(capturedPayload?.camposExtras, {
      disponibilidade_expandida: "Segunda e quarta a tarde",
    });
    assert.equal(capturedPayload?.nivelAcessoVoluntario, "operacional");
    assert.deepEqual(capturedPayload?.anexosProtegidos, {
      documentoIdentidade: {
        assetId: "asset-documento",
        kind: "documentoIdentidade",
        originalName: "rg.pdf",
      },
      fotoPerfil: {
        assetId: "asset-foto",
        kind: "fotoPerfil",
        originalName: "perfil.webp",
      },
    });
  } finally {
    UsuarioService.criar = originalCriar;
  }
});
