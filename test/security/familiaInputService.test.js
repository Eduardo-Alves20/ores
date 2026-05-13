const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeFamilyAddress,
  normalizeFamilyObservacoes,
  normalizeFamilyResponsible,
} = require("../../services/familia/api/familiaInputService");

test("normalizeFamilyResponsible sanitiza e limita campos conhecidos", () => {
  const result = normalizeFamilyResponsible({
    nome: "  Maria da Silva  ",
    telefone: "  (11) 99999-9999  ",
    email: "  MARIA@EMAIL.COM  ",
    parentesco: "  mae  ",
    nomeResponsavel: "  Joana Souza  ",
    cpfResponsavel: "  111.222.333-44  ",
    dataNascimentoResponsavel: "  1990-05-10  ",
    telefoneResponsavel: "  (21) 98888-7777  ",
    emailResponsavel: "  JOANA@EMAIL.COM  ",
    extra: "ignorar",
  });

  assert.deepEqual(result, {
    nome: "Maria da Silva",
    telefone: "(11) 99999-9999",
    email: "maria@email.com",
    parentesco: "mae",
    nomeResponsavel: "Joana Souza",
    cpfResponsavel: "111.222.333-44",
    dataNascimentoResponsavel: "1990-05-10",
    telefoneResponsavel: "(21) 98888-7777",
    emailResponsavel: "joana@email.com",
  });
});

test("normalizeFamilyAddress aplica allowlist de endereco", () => {
  const result = normalizeFamilyAddress({
    rua: " Rua Central ",
    cidade: " Sao Paulo ",
    estado: " sp ",
    qualquer: "ignorar",
  });

  assert.deepEqual(result, {
    rua: "Rua Central",
    cidade: "Sao Paulo",
    estado: "SP",
  });
});

test("normalizeFamilyObservacoes limita tamanho", () => {
  const longText = "a".repeat(4000);
  assert.equal(normalizeFamilyObservacoes(longText).length, 3000);
});
