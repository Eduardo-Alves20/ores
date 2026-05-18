const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapFamilyFormBodyToPayload,
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

test("mapFamilyFormBodyToPayload converte submissao plana em payload da API", () => {
  const payload = mapFamilyFormBodyToPayload({
    responsavel_nome: " Maria ",
    responsavel_telefone: "21999998888",
    responsavel_email: "MARIA@EMAIL.COM",
    responsavel_familiar_nome: " Joana ",
    responsavel_familiar_cpf: "11122233344",
    responsavel_familiar_nascimento: "1990-05-10",
    endereco_cep: "25000123",
    endereco_estado: "rj",
    observacoes: "  observacao livre ",
    campoExtra_data_nascimento: "2015-01-20",
    campoExtra_vulnerabilidades: ["vul_isolamento", "vul_negligencia"],
    _csrf: "token-ignorado",
  });

  assert.deepEqual(payload.responsavel, {
    nome: "Maria",
    telefone: "(21) 99999-8888",
    email: "maria@email.com",
    parentesco: "responsavel",
    nomeResponsavel: "Joana",
    cpfResponsavel: "111.222.333-44",
    dataNascimentoResponsavel: "1990-05-10",
    telefoneResponsavel: "",
    emailResponsavel: "",
  });

  assert.deepEqual(payload.endereco, {
    cep: "25000-123",
    estado: "RJ",
  });

  assert.equal(payload.observacoes, "observacao livre");
  assert.equal(payload.camposExtras.data_nascimento, "2015-01-20");
  assert.equal(payload.camposExtras.vulnerabilidades, "vul_isolamento,vul_negligencia");
  assert.equal(payload.camposExtras._csrf, undefined);
});
