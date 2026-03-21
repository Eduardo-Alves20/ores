const UsuarioService = require("../../domain/UsuarioService");

async function listManagedUsers(query = {}) {
  const { page, limit, busca, ativo, perfil, sort } = query;
  return UsuarioService.listar({
    page,
    limit,
    busca,
    ativo,
    perfil,
    sort,
  });
}

async function loadManagedUserById(id) {
  return UsuarioService.buscarPorId(id);
}

module.exports = {
  listManagedUsers,
  loadManagedUserById,
};
