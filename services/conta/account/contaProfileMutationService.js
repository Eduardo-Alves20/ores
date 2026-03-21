const Usuario = require("../../../schemas/core/Usuario");
const UsuarioService = require("../../domain/UsuarioService");
const { compararSenha } = require("../../security/passwordService");

function createContaActionError(message, flashKey = "error", redirectTo = "/perfil/editar") {
  const error = new Error(message);
  error.flashKey = flashKey;
  error.redirectTo = redirectTo;
  return error;
}

function buildProfileUpdatePayload(body = {}, { isAdmin = false, isSuperAdmin = false } = {}) {
  if (isAdmin) {
    return {
      nome: String(body?.nome || "").trim(),
      email: String(body?.email || "").trim(),
      login: String(body?.login || "").trim(),
      telefone: String(body?.telefone || "").trim(),
      cpf: String(body?.cpf || "").trim(),
      ...(isSuperAdmin ? { perfil: String(body?.perfil || "").trim() } : {}),
      ...(isSuperAdmin ? { tipoCadastro: String(body?.tipoCadastro || "").trim() } : {}),
      ...(isSuperAdmin ? { ativo: String(body?.ativo || "").trim() === "true" } : {}),
    };
  }

  return {
    email: String(body?.email || "").trim(),
    telefone: String(body?.telefone || "").trim(),
  };
}

function validateProfileUpdatePayload(payload, { isAdmin = false } = {}) {
  if (!payload.email) {
    throw createContaActionError("Email e obrigatorio.");
  }

  if (isAdmin && !payload.nome) {
    throw createContaActionError("Nome e obrigatorio para administrador.");
  }
}

async function updateOwnProfile({ userId, body = {}, isAdmin = false, isSuperAdmin = false }) {
  const payload = buildProfileUpdatePayload(body, { isAdmin, isSuperAdmin });
  validateProfileUpdatePayload(payload, { isAdmin });

  const usuario = await UsuarioService.atualizar(userId, payload, { usuarioId: userId });
  if (!usuario) {
    throw createContaActionError("Usuario nao encontrado.", "error", "/perfil");
  }

  return usuario;
}

async function changeOwnPassword({ userId, body = {} }) {
  const senhaAtual = String(body?.senhaAtual || "");
  const senhaNova = String(body?.senhaNova || "");
  const senhaNovaConfirmacao = String(body?.senhaNovaConfirmacao || "");

  if (!senhaAtual) {
    throw createContaActionError("Informe a senha atual.", "senhaError", "/perfil?senha=1");
  }

  if (!senhaNova) {
    throw createContaActionError("Informe a nova senha.", "senhaError", "/perfil?senha=1");
  }

  if (senhaNova !== senhaNovaConfirmacao) {
    throw createContaActionError(
      "A confirmacao da nova senha nao confere.",
      "senhaError",
      "/perfil?senha=1"
    );
  }

  const usuarioComSenha = await Usuario.findById(userId).select("+senha ativo");
  if (!usuarioComSenha || !usuarioComSenha.ativo) {
    throw createContaActionError(
      "Usuario nao encontrado ou inativo.",
      "senhaError",
      "/perfil?senha=1"
    );
  }

  const senhaAtualOk = await compararSenha(senhaAtual, usuarioComSenha.senha);
  if (!senhaAtualOk?.ok) {
    throw createContaActionError("Senha atual incorreta.", "senhaError", "/perfil?senha=1");
  }

  await UsuarioService.atualizarSenha(userId, senhaNova, { usuarioId: userId });
}

module.exports = {
  buildProfileUpdatePayload,
  changeOwnPassword,
  createContaActionError,
  updateOwnProfile,
  validateProfileUpdatePayload,
};
