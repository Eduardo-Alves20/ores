const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REDACTED_VALUE,
  sanitizeForLog,
  serializeErrorForLog,
} = require("../../services/security/logSanitizerService");

test("sanitizeForLog remove senha, token e cpf de objetos aninhados", () => {
  const sanitized = sanitizeForLog({
    senha: "123456",
    token: "abc",
    nested: {
      cpf: "12345678900",
      ok: "valor",
    },
  });

  assert.equal(sanitized.senha, REDACTED_VALUE);
  assert.equal(sanitized.token, REDACTED_VALUE);
  assert.equal(sanitized.nested.cpf, REDACTED_VALUE);
  assert.equal(sanitized.nested.ok, "valor");
});

test("serializeErrorForLog preserva diagnostico sem expor causa sensivel", () => {
  const error = new Error("Falha no fluxo");
  error.code = "FLOW_FAIL";
  error.cause = {
    authorization: "Bearer segredo",
  };

  const serialized = serializeErrorForLog(error);

  assert.equal(serialized.message, "Falha no fluxo");
  assert.equal(serialized.code, "FLOW_FAIL");
  assert.equal(serialized.cause.authorization, REDACTED_VALUE);
});
