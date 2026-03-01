const PERFIS = Object.freeze({
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  ATENDENTE: "atendente",
  TECNICO: "tecnico",
  USUARIO: "usuario",
});

const PERFIS_LIST = Object.freeze(Object.values(PERFIS));

module.exports = {
  PERFIS,
  PERFIS_LIST,
};
