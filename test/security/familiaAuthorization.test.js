const test = require("node:test");
const assert = require("node:assert/strict");

const { PERMISSIONS } = require("../../config/permissions");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { Atendimento } = require("../../schemas/social/Atendimento");
const Familia = require("../../schemas/social/Familia");
const {
  ensureAccessibleFamily,
} = require("../../services/familia/api/familiaGuardService");
const {
  updateFamily,
} = require("../../services/familia/api/familiaActionService");

const ACTOR_ID = "507f1f77bcf86cd799439011";
const ALLOWED_FAMILY_ID = "507f191e810c19729de860ea";
const BLOCKED_FAMILY_ID = "507f191e810c19729de860eb";

function createScopedUser() {
  return {
    id: ACTOR_ID,
    permissions: [PERMISSIONS.ASSISTIDOS_SCOPE_OWN],
  };
}

async function withScopedFamilyMocks(run, { agendaIds = [], atendimentoIds = [] } = {}) {
  const originalAgendaDistinct = AgendaEvento.distinct;
  const originalAtendimentoDistinct = Atendimento.distinct;

  AgendaEvento.distinct = async () => agendaIds;
  Atendimento.distinct = async () => atendimentoIds;

  try {
    await run();
  } finally {
    AgendaEvento.distinct = originalAgendaDistinct;
    Atendimento.distinct = originalAtendimentoDistinct;
  }
}

test("ensureAccessibleFamily retorna 400 para id de familia invalido", async () => {
  await assert.rejects(
    () =>
      ensureAccessibleFamily({
        user: createScopedUser(),
        familiaId: "id-invalido",
      }),
    (error) =>
      error?.status === 400 &&
      error?.message === "Identificador de familia invalido."
  );
});

test("ensureAccessibleFamily bloqueia familia fora do escopo do voluntario", async () => {
  await withScopedFamilyMocks(async () => {
    await assert.rejects(
      () =>
        ensureAccessibleFamily({
          user: createScopedUser(),
          familiaId: BLOCKED_FAMILY_ID,
        }),
      (error) =>
        error?.status === 403 &&
        error?.message === "Acesso restrito a familias vinculadas ao proprio atendimento."
    );
  }, {
    agendaIds: [ALLOWED_FAMILY_ID],
    atendimentoIds: [],
  });
});

test("updateFamily nao atualiza familia fora do escopo do voluntario", async () => {
  const originalFindByIdAndUpdate = Familia.findByIdAndUpdate;
  let updateCalled = false;

  Familia.findByIdAndUpdate = async () => {
    updateCalled = true;
    return null;
  };

  try {
    await withScopedFamilyMocks(async () => {
      await assert.rejects(
        () =>
          updateFamily({
            id: BLOCKED_FAMILY_ID,
            user: createScopedUser(),
            actorId: ACTOR_ID,
            body: {
              responsavel: {
                nome: "Novo Nome",
              },
            },
          }),
        (error) =>
          error?.status === 403 &&
          error?.message === "Acesso restrito a familias vinculadas ao proprio atendimento."
      );
    }, {
      agendaIds: [ALLOWED_FAMILY_ID],
      atendimentoIds: [],
    });

    assert.equal(updateCalled, false);
  } finally {
    Familia.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});
