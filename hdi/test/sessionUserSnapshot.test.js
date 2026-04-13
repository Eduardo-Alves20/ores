const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSessionUserSnapshot } = require("../src/services/sessionUserSnapshot");

test("buildSessionUserSnapshot mantem apenas campos seguros para a sessao", () => {
  const snapshot = buildSessionUserSnapshot({
    _id: "507f1f77bcf86cd799439011",
    name: "  Usuario Local  ",
    username: "usuario",
    email: "USUARIO@LOCAL.HDI",
    password: "hash-secreto",
    groups: ["LOCAL_USER", "LOCAL_USER", " Time A "],
    favoriteBoards: ["1", "2"],
  });

  assert.deepEqual(snapshot, {
    _id: "507f1f77bcf86cd799439011",
    email: "usuario@local.hdi",
    groups: ["LOCAL_USER", "Time A"],
    name: "Usuario Local",
    username: "usuario",
  });
  assert.equal("password" in snapshot, false);
  assert.equal("favoriteBoards" in snapshot, false);
});
