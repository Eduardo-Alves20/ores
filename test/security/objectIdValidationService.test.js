const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ensureValidObjectId,
  isValidObjectIdInput,
  normalizeObjectIdInput,
} = require("../../services/shared/objectIdValidationService");

test("normalizeObjectIdInput faz trim do identificador", () => {
  assert.equal(normalizeObjectIdInput("  abc  "), "abc");
});

test("isValidObjectIdInput reconhece ObjectId valido", () => {
  assert.equal(isValidObjectIdInput("507f1f77bcf86cd799439011"), true);
  assert.equal(isValidObjectIdInput("invalido"), false);
});

test("ensureValidObjectId retorna id normalizado ou erro 400", () => {
  assert.equal(
    ensureValidObjectId(" 507f1f77bcf86cd799439011 ", "ID invalido."),
    "507f1f77bcf86cd799439011"
  );

  assert.throws(
    () => ensureValidObjectId("nao-e-objectid", "ID invalido."),
    (error) => error?.status === 400 && error?.code === "INVALID_OBJECT_ID"
  );
});
