const Usuario = require("../../../../schemas/core/Usuario");
const FuncaoAcesso = require("../../../../schemas/core/FuncaoAcesso");
const { PERFIS } = require("../../../../config/roles");
const {
  normalizePermissionList,
} = require("../../../../config/permissions");
const { parseBoolean } = require("../../../shared/valueParsingService");
const {
  createSecurityActionError,
  isValidObjectId,
  normalizeObjectId,
  resolveReturnTo,
  slugify,
  toArray,
} = require("./securityContextService");

function normalizeRolePayload(body = {}) {
  return {
    nome: String(body?.nome || "").trim().slice(0, 80),
    slugInformado: String(body?.slug || "").trim(),
    descricao: String(body?.descricao || "").trim().slice(0, 400),
    ativo: parseBoolean(body?.ativo),
    permissoes: normalizePermissionList(toArray(body?.permissoes)),
  };
}

function validateRoleIdentity(id, redirectTo) {
  const normalizedId = normalizeObjectId(id);
  if (!isValidObjectId(normalizedId)) {
    throw createSecurityActionError("Funcao invalida.", redirectTo);
  }
  return normalizedId;
}

function resolveRoleSlug(payload, redirectTo) {
  const slug = slugify(payload.slugInformado || payload.nome);
  if (!slug) {
    throw createSecurityActionError("Slug invalido para a funcao.", redirectTo);
  }
  return slug;
}

function validateRoleName(payload, redirectTo) {
  if (!payload.nome) {
    throw createSecurityActionError("Nome da funcao e obrigatorio.", redirectTo);
  }
}

async function createSecurityRole({ actorId, body = {} }) {
  const redirectTo = "/seguranca/funcoes";

  try {
    const payload = normalizeRolePayload(body);
    validateRoleName(payload, redirectTo);
    const slug = resolveRoleSlug(payload, redirectTo);

    const funcao = await FuncaoAcesso.create({
      nome: payload.nome,
      slug,
      descricao: payload.descricao,
      permissoes: payload.permissoes,
      ativo: typeof payload.ativo === "undefined" ? true : payload.ativo,
      criadoPor: actorId,
      atualizadoPor: actorId,
    });

    return {
      successMessage: "Funcao criada com sucesso.",
      redirectTo,
      audit: {
        acao: "FUNCAO_ACESSO_CRIADA",
        entidade: "seguranca",
        entidadeId: String(funcao._id),
        detalhes: { slug, permissoes: funcao.permissoes || [] },
      },
    };
  } catch (error) {
    if (!error.redirectTo) error.redirectTo = redirectTo;
    throw error;
  }
}

async function updateSecurityRole({ actorId, id, body = {} }) {
  const normalizedId = normalizeObjectId(id);
  const editRedirectTo = `/seguranca/funcoes?editar=${normalizedId}`;

  try {
    const roleId = validateRoleIdentity(normalizedId, "/seguranca/funcoes");
    const payload = normalizeRolePayload(body);
    validateRoleName(payload, editRedirectTo);
    const slug = resolveRoleSlug(payload, editRedirectTo);

    const funcao = await FuncaoAcesso.findByIdAndUpdate(
      roleId,
      {
        nome: payload.nome,
        slug,
        descricao: payload.descricao,
        permissoes: payload.permissoes,
        ...(typeof payload.ativo === "undefined" ? {} : { ativo: payload.ativo }),
        atualizadoPor: actorId,
      },
      { new: true, runValidators: true }
    );

    if (!funcao) {
      throw createSecurityActionError("Funcao nao encontrada.", "/seguranca/funcoes");
    }

    return {
      successMessage: "Funcao atualizada com sucesso.",
      redirectTo: "/seguranca/funcoes",
      audit: {
        acao: "FUNCAO_ACESSO_ATUALIZADA",
        entidade: "seguranca",
        entidadeId: String(funcao._id),
      },
    };
  } catch (error) {
    if (!error.redirectTo) error.redirectTo = editRedirectTo;
    throw error;
  }
}

async function changeSecurityRoleStatus({ actorId, id, ativoInput, returnTo }) {
  const redirectTo = resolveReturnTo(returnTo);

  try {
    const roleId = validateRoleIdentity(id, redirectTo);
    const ativo = parseBoolean(ativoInput);

    if (typeof ativo === "undefined") {
      throw createSecurityActionError("Campo ativo e obrigatorio.", redirectTo);
    }

    const funcao = await FuncaoAcesso.findByIdAndUpdate(
      roleId,
      { ativo, atualizadoPor: actorId },
      { new: true, runValidators: true }
    );

    if (!funcao) {
      throw createSecurityActionError("Funcao nao encontrada.", redirectTo);
    }

    return {
      successMessage: ativo
        ? "Funcao ativada com sucesso."
        : "Funcao inativada com sucesso.",
      redirectTo,
      audit: {
        acao: ativo ? "FUNCAO_ACESSO_ATIVADA" : "FUNCAO_ACESSO_INATIVADA",
        entidade: "seguranca",
        entidadeId: String(funcao._id),
      },
    };
  } catch (error) {
    if (!error.redirectTo) error.redirectTo = redirectTo;
    throw error;
  }
}

async function assignSecurityRolesToUser({ actorId, usuarioId, body = {} }) {
  const redirectTo = resolveReturnTo(body?.returnTo);

  try {
    const normalizedUserId = normalizeObjectId(usuarioId);
    if (!isValidObjectId(normalizedUserId)) {
      throw createSecurityActionError("Usuario invalido.", redirectTo);
    }

    const funcoesRecebidas = toArray(body?.funcoes)
      .map((item) => String(item || "").trim())
      .filter((item) => isValidObjectId(item));

    const [usuario, funcoesValidas] = await Promise.all([
      Usuario.findById(normalizedUserId).select("_id perfil nome funcoesAcesso").lean(),
      FuncaoAcesso.find({
        _id: { $in: funcoesRecebidas },
      })
        .select("_id")
        .lean(),
    ]);

    if (!usuario) {
      throw createSecurityActionError("Usuario nao encontrado.", redirectTo);
    }

    if (String(usuario.perfil || "").toLowerCase() === PERFIS.SUPERADMIN) {
      throw createSecurityActionError(
        "Nao e permitido alterar funcoes do SuperAdmin.",
        redirectTo
      );
    }

    const funcoesIds = funcoesValidas.map((item) => item._id);

    await Usuario.findByIdAndUpdate(
      normalizedUserId,
      {
        funcoesAcesso: funcoesIds,
        atualizadoPor: actorId,
      },
      { runValidators: true }
    );

    return {
      successMessage: "Funcoes do usuario atualizadas com sucesso.",
      redirectTo,
      refreshUserId: normalizedUserId,
      audit: {
        acao: "USUARIO_FUNCOES_ATRIBUIDAS",
        entidade: "usuario",
        entidadeId: String(normalizedUserId),
        detalhes: {
          totalFuncoes: funcoesIds.length,
        },
      },
    };
  } catch (error) {
    if (!error.redirectTo) error.redirectTo = redirectTo;
    throw error;
  }
}

module.exports = {
  assignSecurityRolesToUser,
  changeSecurityRoleStatus,
  createSecurityRole,
  normalizeRolePayload,
  resolveRoleSlug,
  updateSecurityRole,
  validateRoleIdentity,
  validateRoleName,
};
