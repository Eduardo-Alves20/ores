const test = require("node:test");
const assert = require("node:assert/strict");

const { PERMISSIONS } = require("../../config/permissions");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../schemas/social/AgendaSala");
const {
  getAgendaEventDetail,
  listAgendaEvents,
} = require("../../services/agenda/domain/agendaEventQueryService");
const {
  listAvailableAgendaRooms,
} = require("../../services/agenda/domain/agendaLookupService");
const {
  changeAgendaEventStatus,
} = require("../../services/agenda/domain/agendaEventStatusService");
const {
  updateAgendaRoom,
} = require("../../services/agenda/domain/agendaRoomService");

const ACTOR_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439012";
const EVENT_ID = "507f191e810c19729de860ea";

function createAgendaViewer(overrides = {}) {
  return {
    id: ACTOR_ID,
    permissions: [PERMISSIONS.AGENDA_VIEW],
    ...overrides,
  };
}

function createAgendaManager(overrides = {}) {
  return {
    id: ACTOR_ID,
    permissions: [PERMISSIONS.AGENDA_VIEW, PERMISSIONS.AGENDA_VIEW_ALL],
    ...overrides,
  };
}

test("getAgendaEventDetail retorna 400 para id de agendamento invalido", async () => {
  const originalFindById = AgendaEvento.findById;
  let findCalled = false;

  AgendaEvento.findById = async () => {
    findCalled = true;
    return null;
  };

  try {
    await assert.rejects(
      () => getAgendaEventDetail(createAgendaViewer(), "evento-invalido"),
      (error) =>
        error?.status === 400 &&
        error?.publicMessage === "Identificador de agendamento invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    AgendaEvento.findById = originalFindById;
  }
});

test("updateAgendaRoom retorna 400 para id de sala invalido", async () => {
  const originalFindById = AgendaSala.findById;
  let findCalled = false;

  AgendaSala.findById = async () => {
    findCalled = true;
    return null;
  };

  try {
    await assert.rejects(
      () =>
        updateAgendaRoom(createAgendaManager(), "sala-invalida", {
          nome: "Sala Azul",
        }),
      (error) =>
        error?.status === 400 &&
        error?.publicMessage === "Identificador de sala invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    AgendaSala.findById = originalFindById;
  }
});

test("changeAgendaEventStatus bloqueia mutacao de evento fora do responsavel", async () => {
  const originalFindById = AgendaEvento.findById;
  const originalFindByIdAndUpdate = AgendaEvento.findByIdAndUpdate;
  let updateCalled = false;

  AgendaEvento.findById = async () => ({
    _id: EVENT_ID,
    titulo: "Sessao",
    responsavelId: OTHER_ID,
  });
  AgendaEvento.findByIdAndUpdate = async () => {
    updateCalled = true;
    return null;
  };

  try {
    await assert.rejects(
      () =>
        changeAgendaEventStatus(
          {
            id: ACTOR_ID,
            permissions: [PERMISSIONS.AGENDA_STATUS],
          },
          EVENT_ID,
          true
        ),
      (error) =>
        error?.status === 403 &&
        error?.publicMessage === "Sem permissao para alterar este evento."
    );

    assert.equal(updateCalled, false);
  } finally {
    AgendaEvento.findById = originalFindById;
    AgendaEvento.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("listAgendaEvents rejeita responsavelId invalido sem consultar o banco", async () => {
  const originalFind = AgendaEvento.find;
  let findCalled = false;

  AgendaEvento.find = () => {
    findCalled = true;
    return {
      sort() {
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return [];
      },
    };
  };

  try {
    await assert.rejects(
      () =>
        listAgendaEvents(createAgendaManager(), {
          inicio: "2026-03-01T08:00:00.000Z",
          fim: "2026-03-02T08:00:00.000Z",
          responsavelId: "responsavel-invalido",
        }),
      (error) =>
        error?.status === 400 &&
        error?.publicMessage === "Responsavel informado e invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    AgendaEvento.find = originalFind;
  }
});

test("listAvailableAgendaRooms rejeita eventoId invalido sem listar salas", async () => {
  const originalFind = AgendaSala.find;
  let findCalled = false;

  AgendaSala.find = () => {
    findCalled = true;
    return {
      sort() {
        return this;
      },
      lean() {
        return [];
      },
    };
  };

  try {
    await assert.rejects(
      () =>
        listAvailableAgendaRooms(createAgendaViewer(), {
          inicio: "2026-03-01T08:00:00.000Z",
          fim: "2026-03-01T09:00:00.000Z",
          eventoId: "evento-invalido",
        }),
      (error) =>
        error?.status === 400 &&
        error?.publicMessage === "Identificador de agendamento invalido."
    );

    assert.equal(findCalled, false);
  } finally {
    AgendaSala.find = originalFind;
  }
});
