const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_USER_SEARCH_LENGTH,
  buildUserListFilter,
  normalizeUserListOptions,
} = require("../../services/domain/userListQueryService");

test("normalizeUserListOptions limita pagina, tamanho e busca", () => {
  const options = normalizeUserListOptions({
    page: "-7",
    limit: "999",
    busca: "a".repeat(MAX_USER_SEARCH_LENGTH + 25),
  });

  assert.equal(options.page, 1);
  assert.equal(options.limit, 100);
  assert.equal(options.busca.length, MAX_USER_SEARCH_LENGTH);
});

test("buildUserListFilter escapa metacaracteres regex na busca", () => {
  const filter = buildUserListFilter({
    busca: "admin.*(root)?",
  });

  assert.ok(Array.isArray(filter.$or));
  const firstRegex = filter.$or[0].nome.$regex;
  assert.ok(firstRegex instanceof RegExp);
  assert.equal(firstRegex.flags, "i");
  assert.equal(firstRegex.source, "admin\\.\\*\\(root\\)\\?");
});

test("buildUserListFilter preserva filtros explicitos permitidos", () => {
  const filter = buildUserListFilter({
    ativo: true,
    perfil: "admin",
    tipoCadastro: "familia",
    statusAprovacao: "aprovado",
  });

  assert.equal(filter.ativo, true);
  assert.equal(filter.perfil, "admin");
  assert.equal(filter.tipoCadastro, "familia");
  assert.equal(filter.statusAprovacao, "aprovado");
});
