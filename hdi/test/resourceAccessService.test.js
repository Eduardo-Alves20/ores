const test = require("node:test");
const assert = require("node:assert/strict");

const Board = require("../src/models/Board");
const List = require("../src/models/List");
const Card = require("../src/models/Card");
const {
  escapeRegexLiteral,
  resolveScopedAccess,
} = require("../src/services/resourceAccessService");

const IDS = {
  boardA: "507f1f77bcf86cd799439011",
  boardB: "507f1f77bcf86cd799439012",
  cardA: "507f1f77bcf86cd799439013",
  listA: "507f1f77bcf86cd799439014",
  userA: "507f1f77bcf86cd799439015",
  userB: "507f1f77bcf86cd799439016",
};

function chainableResult(value) {
  return {
    select() {
      return {
        lean: async () => value,
      };
    },
  };
}

function withModelStubs(stubs, run) {
  const originals = new Map();

  for (const [target, methods] of stubs) {
    const stored = {};
    for (const [key, value] of Object.entries(methods)) {
      stored[key] = target[key];
      target[key] = value;
    }
    originals.set(target, stored);
  }

  const restore = () => {
    for (const [target, methods] of originals.entries()) {
      for (const [key, value] of Object.entries(methods)) {
        target[key] = value;
      }
    }
  };

  return Promise.resolve()
    .then(run)
    .finally(restore);
}

test("resolveScopedAccess rejeita card fora do escopo do board", async () => {
  await withModelStubs(
    [
      [
        Card,
        {
          findById() {
            return chainableResult({
              _id: IDS.cardA,
              boardId: IDS.boardB,
              listId: IDS.listA,
            });
          },
        },
      ],
      [
        List,
        {
          findById() {
            throw new Error("List.findById nao deveria ser chamado");
          },
        },
      ],
      [
        Board,
        {
          findById() {
            throw new Error("Board.findById nao deveria ser chamado");
          },
        },
      ],
    ],
    async () => {
      await assert.rejects(
        () =>
          resolveScopedAccess({
            boardId: IDS.boardA,
            cardId: IDS.cardA,
            userId: IDS.userA,
            requiredRole: "observer",
          }),
        /escopo do board/i,
      );
    }
  );
});

test("resolveScopedAccess permite acesso do dono via card sem boardId", async () => {
  await withModelStubs(
    [
      [
        Card,
        {
          findById() {
            return chainableResult({
              _id: IDS.cardA,
              boardId: IDS.boardA,
              listId: IDS.listA,
            });
          },
        },
      ],
      [
        List,
        {
          findById() {
            throw new Error("List.findById nao deveria ser chamado");
          },
        },
      ],
      [
        Board,
        {
          findById() {
            return chainableResult({
              _id: IDS.boardA,
              owner: IDS.userA,
              members: [],
            });
          },
        },
      ],
    ],
    async () => {
      const result = await resolveScopedAccess({
        cardId: IDS.cardA,
        userId: IDS.userA,
        requiredRole: "observer",
      });

      assert.equal(result.boardId, IDS.boardA);
      assert.equal(result.currentRole, "admin");
    }
  );
});

test("resolveScopedAccess bloqueia membro observer em rota de editor", async () => {
  await withModelStubs(
    [
      [
        Card,
        {
          findById() {
            return chainableResult({
              _id: IDS.cardA,
              boardId: IDS.boardA,
              listId: IDS.listA,
            });
          },
        },
      ],
      [
        List,
        {
          findById() {
            throw new Error("List.findById nao deveria ser chamado");
          },
        },
      ],
      [
        Board,
        {
          findById() {
            return chainableResult({
              _id: IDS.boardA,
              owner: IDS.userB,
              members: [{ user: IDS.userA, role: "observer" }],
            });
          },
        },
      ],
    ],
    async () => {
      await assert.rejects(
        () =>
          resolveScopedAccess({
            cardId: IDS.cardA,
            userId: IDS.userA,
            requiredRole: "editor",
          }),
        /permissao insuficiente/i,
      );
    }
  );
});

test("escapeRegexLiteral neutraliza metacaracteres de regex", () => {
  assert.equal(escapeRegexLiteral("a+b?(teste)"), "a\\+b\\?\\(teste\\)");
});
