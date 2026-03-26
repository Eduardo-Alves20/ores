const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSessionUserPayload,
  normalizeAuthVersion,
  resolveSessionInvalidationReason,
  shouldBumpAuthVersion,
} = require("../../services/security/sessionSecurityService");

test("buildSessionUserPayload normaliza campos sensiveis da sessao", () => {
  const payload = buildSessionUserPayload(
    {
      _id: "507f1f77bcf86cd799439011",
      nome: "  Maria  ",
      email: "MARIA@EXEMPLO.COM",
      perfil: "USUARIO",
      tipoCadastro: "Familia",
      nivelAcessoVoluntario: null,
      authVersion: "3",
    },
    ["portal.meus-dados"]
  );

  assert.deepEqual(payload, {
    id: "507f1f77bcf86cd799439011",
    nome: "Maria",
    email: "maria@exemplo.com",
    perfil: "usuario",
    tipoCadastro: "familia",
    nivelAcessoVoluntario: "",
    authVersion: 3,
    permissions: ["portal.meus-dados"],
  });
});

test("shouldBumpAuthVersion sobe versao apenas em campos de autenticacao ou autorizacao", () => {
  assert.equal(shouldBumpAuthVersion({ telefone: "9999-9999" }), false);
  assert.equal(shouldBumpAuthVersion({ statusAprovacao: "rejeitado" }), true);
  assert.equal(shouldBumpAuthVersion({ funcoesAcesso: ["1"] }), true);
});

test("resolveSessionInvalidationReason detecta revogacao de aprovacao e mudanca de versao", () => {
  const sessionUser = {
    id: "507f1f77bcf86cd799439011",
    perfil: "usuario",
    tipoCadastro: "familia",
    nivelAcessoVoluntario: "",
    authVersion: 2,
  };

  assert.equal(
    resolveSessionInvalidationReason(sessionUser, {
      ativo: true,
      perfil: "usuario",
      tipoCadastro: "familia",
      nivelAcessoVoluntario: "",
      statusAprovacao: "pendente",
      authVersion: 2,
    }),
    "APPROVAL_REVOKED"
  );

  assert.equal(
    resolveSessionInvalidationReason(sessionUser, {
      ativo: true,
      perfil: "usuario",
      tipoCadastro: "familia",
      nivelAcessoVoluntario: "",
      statusAprovacao: "aprovado",
      authVersion: 3,
    }),
    "AUTH_VERSION_MISMATCH"
  );
});

test("normalizeAuthVersion protege contra valores invalidos", () => {
  assert.equal(normalizeAuthVersion(undefined), 0);
  assert.equal(normalizeAuthVersion(-10), 0);
  assert.equal(normalizeAuthVersion("7.9"), 7);
});
