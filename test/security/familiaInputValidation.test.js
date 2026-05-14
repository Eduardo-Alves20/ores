const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeFamilyResponsible,
  normalizeFamilyAddress,
  isValidCpf,
  isValidPhone,
  isValidCep,
  isNotFutureIsoDate,
} = require("../../services/familia/api/familiaInputService");

test("normalizeFamilyResponsible aplica mascara e sanitiza campos sensiveis", () => {
  const result = normalizeFamilyResponsible({
    nome: "  <b>Maria</b>  ",
    telefone: "21999998888<script>",
    email: "MARIa@Email.COM",
    cpfResponsavel: "12345678901",
    telefoneResponsavel: "(21) 98888-7777",
    emailResponsavel: "nao-e-email",
  });

  assert.equal(result.nome, "bMaria/b");
  assert.equal(result.telefone, "(21) 99999-8888");
  assert.equal(result.email, "maria@email.com");
  assert.equal(result.cpfResponsavel, "123.456.789-01");
  assert.equal(result.telefoneResponsavel, "(21) 98888-7777");
  assert.equal(result.emailResponsavel, "");
});

test("normalizeFamilyAddress formata cep e normaliza estado", () => {
  const result = normalizeFamilyAddress({
    cep: "25000-123<script>",
    rua: " Rua Teste <img>",
    numero: "12A<script>",
    cidade: "Duque de Caxias",
    estado: "rj",
  });

  assert.equal(result.cep, "25000-123");
  assert.equal(result.rua, "Rua Teste img");
  assert.equal(result.numero, "12");
  assert.equal(result.cidade, "Duque de Caxias");
  assert.equal(result.estado, "RJ");
});

test("validadores de cpf, telefone e cep aceitam apenas tamanhos esperados", () => {
  assert.equal(isValidCpf("123.456.789-01"), true);
  assert.equal(isValidCpf("123"), false);

  assert.equal(isValidPhone("(21) 99999-8888"), true);
  assert.equal(isValidPhone("219888"), false);

  assert.equal(isValidCep("25000-123"), true);
  assert.equal(isValidCep("2500012"), false);
});

test("isNotFutureIsoDate bloqueia datas futuras", () => {
  assert.equal(isNotFutureIsoDate("2000-01-01"), true);
  assert.equal(isNotFutureIsoDate("2100-01-01"), false);
});
