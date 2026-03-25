const UsuarioService = require("../../domain/UsuarioService");
const { PERFIS } = require("../../../config/roles");
const { parseBoolean } = require("../../shared/valueParsingService");
const {
  createUserAdminError,
  ensureManageableTarget,
  isSuperAdminProfile,
} = require("./userContextService");

function normalizeRequestedProfile(value) {
  return String(value || "").trim().toLowerCase();
}

function buildCreatePayload(body = {}) {
  return {
    nome: body?.nome,
    email: body?.email,
    login: body?.login,
    senha: body?.senha,
    telefone: body?.telefone,
    dataNascimento: body?.dataNascimento,
    cpf: body?.cpf,
    perfil: body?.perfil,
    tipoCadastro: body?.tipoCadastro,
    statusAprovacao: body?.statusAprovacao,
    motivoAprovacao: body?.motivoAprovacao,
    papelAprovacao: body?.papelAprovacao,
    ativo: body?.ativo,
  };
}

function ensureCanSetRequestedProfile(requestedProfile, currentProfile, message) {
  if (requestedProfile === PERFIS.SUPERADMIN && !isSuperAdminProfile(currentProfile)) {
    throw createUserAdminError(message, 403);
  }
}

async function createManagedUser({ body = {}, actorContext = {}, currentProfile = "" }) {
  const requestedProfile = normalizeRequestedProfile(body?.perfil);
  ensureCanSetRequestedProfile(
    requestedProfile,
    currentProfile,
    "Somente superadmin pode criar outro superadmin."
  );

  const usuario = await UsuarioService.criar(buildCreatePayload(body), actorContext);

  return {
    mensagem: "Usuario criado com sucesso.",
    usuario,
    audit: {
      acao: "USUARIO_CRIADO",
      entidade: "usuario",
      entidadeId: usuario?._id,
    },
  };
}

async function updateManagedUser({ id, body = {}, actorContext = {}, currentProfile = "" }) {
  const requestedProfile = normalizeRequestedProfile(body?.perfil);
  ensureCanSetRequestedProfile(
    requestedProfile,
    currentProfile,
    "Somente superadmin pode promover um usuario para superadmin."
  );

  const alvo = await ensureManageableTarget({ currentProfile, id });
  if (!alvo) return null;

  const usuario = await UsuarioService.atualizar(id, body, actorContext);
  if (!usuario) return null;

  return {
    mensagem: "Usuario atualizado com sucesso.",
    usuario,
    audit: {
      acao: "USUARIO_ATUALIZADO",
      entidade: "usuario",
      entidadeId: id,
    },
  };
}

async function resetManagedUserPassword({
  id,
  body = {},
  actorContext = {},
  currentProfile = "",
}) {
  const senha = body?.senha;
  const motivoNormalizado = String(body?.motivo || "").trim();

  if (!senha) {
    throw createUserAdminError("Campo senha e obrigatorio.", 400);
  }

  if (!motivoNormalizado) {
    throw createUserAdminError("Informe o motivo da redefinicao para auditoria.", 400);
  }

  const alvo = await ensureManageableTarget({ currentProfile, id });
  if (!alvo) return null;

  const usuario = await UsuarioService.atualizarSenha(id, senha, actorContext);
  if (!usuario) return null;

  return {
    mensagem: "Senha redefinida com sucesso.",
    usuario,
    audit: {
      acao: "USUARIO_SENHA_REDEFINIDA",
      entidade: "usuario",
      entidadeId: id,
      detalhes: {
        motivo: motivoNormalizado,
        usuarioAlvo: alvo?.nome || "",
        loginAlvo: alvo?.login || "",
        tipoCadastro: alvo?.tipoCadastro || "",
      },
    },
  };
}

async function changeManagedUserStatus({
  id,
  body = {},
  actorContext = {},
  currentProfile = "",
}) {
  if (typeof body?.ativo === "undefined") {
    throw createUserAdminError("Campo ativo e obrigatorio.", 400);
  }

  const ativo = parseBoolean(body?.ativo);
  if (typeof ativo === "undefined") {
    throw createUserAdminError("Campo ativo invalido.", 400);
  }

  const alvo = await ensureManageableTarget({ currentProfile, id });
  if (!alvo) return null;

  const usuario = await UsuarioService.alterarStatus(id, ativo, actorContext);
  if (!usuario) return null;

  return {
    mensagem: "Status atualizado com sucesso.",
    usuario,
    audit: {
      acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_INATIVADO",
      entidade: "usuario",
      entidadeId: id,
    },
  };
}

async function deactivateManagedUser({ id, actorContext = {}, currentProfile = "" }) {
  const alvo = await ensureManageableTarget({ currentProfile, id });
  if (!alvo) return null;

  const usuario = await UsuarioService.remover(id, actorContext);
  if (!usuario) return null;

  return {
    mensagem: "Usuario inativado com sucesso.",
    usuario,
    audit: {
      acao: "USUARIO_INATIVADO",
      entidade: "usuario",
      entidadeId: id,
    },
  };
}

module.exports = {
  buildCreatePayload,
  changeManagedUserStatus,
  createManagedUser,
  deactivateManagedUser,
  ensureCanSetRequestedProfile,
  normalizeRequestedProfile,
  resetManagedUserPassword,
  updateManagedUser,
};
