const test = require("node:test");
const assert = require("node:assert/strict");

const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { Atendimento } = require("../../schemas/social/Atendimento");
const { PERMISSIONS } = require("../../config/permissions");
const {
  changeAttendanceStatus,
  normalizeAttendanceType,
} = require("../../services/familia/api/atendimentoActionService");
const {
  registerFamilyAbsence,
} = require("../../services/portal/family/portalFamilyAgendaActionService");

const ACTOR_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439012";
const FAMILY_ID = "507f191e810c19729de860ea";
const ATTENDANCE_ID = "507f191e810c19729de860eb";

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

test("normalizeAttendanceType rejeita tipo de atendimento invalido", () => {
  assert.equal(normalizeAttendanceType("whatsapp"), "whatsapp");

  assert.throws(
    () => normalizeAttendanceType("script"),
    (error) =>
      error?.status === 400 &&
      error?.message === "Tipo de atendimento invalido."
  );
});

test("changeAttendanceStatus bloqueia voluntario fora do proprio atendimento", async () => {
  const originalFindById = Atendimento.findById;
  const originalFindByIdAndUpdate = Atendimento.findByIdAndUpdate;
  let updateCalled = false;

  Atendimento.findById = () => ({
    select: async () => ({
      _id: ATTENDANCE_ID,
      familiaId: FAMILY_ID,
      pacienteId: null,
      profissionalId: OTHER_ID,
    }),
  });
  Atendimento.findByIdAndUpdate = async () => {
    updateCalled = true;
    return null;
  };

  try {
    await withScopedFamilyMocks(async () => {
      await assert.rejects(
        () =>
          changeAttendanceStatus({
            user: createScopedUser(),
            actorId: ACTOR_ID,
            id: ATTENDANCE_ID,
            ativoInput: false,
          }),
        (error) =>
          error?.status === 403 &&
          error?.message ===
            "Voluntarios de atendimento so podem alterar status de registros vinculados a si mesmos."
      );
    }, {
      agendaIds: [],
      atendimentoIds: [FAMILY_ID],
    });

    assert.equal(updateCalled, false);
  } finally {
    Atendimento.findById = originalFindById;
    Atendimento.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("registerFamilyAbsence rejeita id de agendamento invalido sem consultar o banco", async () => {
  const originalFindOne = AgendaEvento.findOne;
  let findCalled = false;

  AgendaEvento.findOne = () => {
    findCalled = true;
    return {
      populate() {
        return this;
      },
      lean() {
        return null;
      },
    };
  };

  try {
    await assert.rejects(
      () =>
        registerFamilyAbsence(
          {
            userId: ACTOR_ID,
            familia: { _id: FAMILY_ID },
          },
          "evento-invalido",
          {}
        ),
      (error) =>
        error?.status === 400 &&
        error?.publicMessage === "Identificador de agendamento invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    AgendaEvento.findOne = originalFindOne;
  }
});
