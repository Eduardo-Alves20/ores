const PERFIS = Object.freeze({
  ADMIN: "admin",
  ATENDENTE: "atendente",
  TECNICO: "tecnico",
});

const PERFIS_LIST = Object.freeze(Object.values(PERFIS));

module.exports = {
  PERFIS,
  PERFIS_LIST,
};

