const Usuario = require("../../../schemas/core/Usuario");
const UsuarioService = require("../../domain/UsuarioService");
const {
  getVolunteerAccessLabel,
  normalizeVolunteerAccessLevel,
} = require("../../../config/volunteerAccess");
const { getProfileLabel } = require("../../../config/roles");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");
const { parseBoolean } = require("../../shared/valueParsingService");
const {
  canManageTargetUser,
  isSuperAdminRequest,
  canManageUsers,
  isAdmin,
  canReviewSensitiveApprovalData,
} = require("./accessPermissionService");
const { normalizeAssetKind } = require("../../security/secureVolunteerAssetService");
const {
  mapApprovalDetail,
} = require("./accessApprovalWorkflowService");

function createActionError(message, status = null) {
  const error = new Error(message);
  if (status) error.status = status;
  error.publicMessage = message;
  return error;
}

function ensureAccessUserId(id) {
  try {
    return ensureValidObjectId(id, "Usuario invalido.");
  } catch (error) {
    if (error?.status === 400 || error?.code === "INVALID_OBJECT_ID") {
      throw createActionError("Usuario invalido.", 400);
    }
    throw error;
  }
}

function resolveProtectedAttachmentField(kind) {
  const normalizedKind = normalizeAssetKind(kind);
  if (!normalizedKind) {
    throw createActionError("Tipo de anexo protegido invalido.", 400);
  }

  return normalizedKind;
}

async function loadApprovalDetailPayload(id, actorId = null) {
  const normalizedId = ensureAccessUserId(id);
  const usuario = await UsuarioService.buscarPorId(normalizedId);

  if (!usuario) {
    return null;
  }

  return mapApprovalDetail(usuario, actorId);
}

async function loadProtectedApprovalAsset(id, kind) {
  const normalizedId = ensureAccessUserId(id);
  const field = resolveProtectedAttachmentField(kind);
  const usuario = await Usuario.findById(normalizedId)
    .select("anexosProtegidos nome tipoCadastro")
    .lean();

  if (!usuario) {
    return null;
  }

  return {
    usuario,
    asset: usuario?.anexosProtegidos?.[field] || null,
    field,
  };
}

async function approveUserAccess({ id, actorId = null, body = {} }) {
  const normalizedId = ensureAccessUserId(id);
  const usuarioAtual = await Usuario.findById(normalizedId)
    .select("_id nome perfil tipoCadastro statusAprovacao nivelAcessoVoluntario")
    .lean();

  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  const nivelAcessoVoluntario = usuarioAtual.tipoCadastro === "voluntario"
    ? normalizeVolunteerAccessLevel(
        body?.nivelAcessoVoluntario || usuarioAtual.nivelAcessoVoluntario,
        null
      )
    : null;

  if (usuarioAtual.tipoCadastro === "voluntario" && !nivelAcessoVoluntario) {
    throw createActionError("Selecione o nivel de acesso do voluntario antes de aprovar.");
  }

  const payload = {
    statusAprovacao: "aprovado",
    motivoAprovacao: "",
  };

  if (usuarioAtual.tipoCadastro === "voluntario") {
    payload.nivelAcessoVoluntario = nivelAcessoVoluntario;
  }

  const ativoBody = parseBoolean(body?.ativo);
  if (Object.prototype.hasOwnProperty.call(body, "ativo") && typeof ativoBody === "undefined") {
    throw createActionError("Campo ativo invalido.", 400);
  }

  if (typeof ativoBody !== "undefined") {
    payload.ativo = ativoBody;
  } else if (usuarioAtual.tipoCadastro === "voluntario") {
    payload.ativo = true;
  }

  const usuario = await UsuarioService.atualizar(normalizedId, payload, { usuarioId: actorId });
  if (!usuario) {
    throw createActionError("Usuario nao encontrado.");
  }

  return {
    usuario,
    successMessage:
      usuario.tipoCadastro === "voluntario"
        ? `Cadastro aprovado com sucesso como ${getVolunteerAccessLabel(usuario.nivelAcessoVoluntario)}.`
        : "Cadastro aprovado com sucesso.",
    audit: {
      acao: "USUARIO_APROVADO",
      entidade: "usuario",
      entidadeId: normalizedId,
      detalhes: {
        tipoCadastro: usuario.tipoCadastro,
        ativo: usuario.ativo,
        nivelAcessoVoluntario: usuario.nivelAcessoVoluntario || "",
      },
    },
  };
}

async function rejectUserAccess({ id, actorId = null, motivo = "" }) {
  const normalizedId = ensureAccessUserId(id);
  const usuarioAtual = await Usuario.findById(normalizedId)
    .select("_id nome perfil statusAprovacao")
    .lean();

  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  const usuario = await UsuarioService.atualizar(
    normalizedId,
    {
      statusAprovacao: "rejeitado",
      motivoAprovacao: motivo,
      ativo: false,
      nivelAcessoVoluntario: null,
    },
    { usuarioId: actorId }
  );

  if (!usuario) {
    throw createActionError("Usuario nao encontrado.");
  }

  return {
    usuario,
    successMessage: "Cadastro rejeitado e acesso bloqueado.",
    audit: {
      acao: "USUARIO_REJEITADO",
      entidade: "usuario",
      entidadeId: normalizedId,
      detalhes: {
        motivo: motivo || "",
      },
    },
  };
}

async function changeUserAccessStatus({ req, id, actorId = null, ativo }) {
  if (typeof ativo === "undefined") {
    throw createActionError("Campo ativo e obrigatorio.");
  }

  const normalizedId = ensureAccessUserId(id);
  const usuarioAtual = await Usuario.findById(normalizedId).select("_id perfil").lean();
  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  if (!canManageTargetUser(req, usuarioAtual)) {
    throw createActionError("Somente superadmin pode alterar status de outro superadmin.");
  }

  const usuario = await UsuarioService.alterarStatus(normalizedId, ativo, { usuarioId: actorId });
  if (!usuario) {
    throw createActionError("Usuario nao encontrado.");
  }

  return {
    usuario,
    successMessage: ativo ? "Acesso ativado com sucesso." : "Acesso inativado com sucesso.",
    audit: {
      acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_INATIVADO",
      entidade: "usuario",
      entidadeId: normalizedId,
    },
  };
}

async function removeUserAccess({ req, id, actorId = null }) {
  if (!isSuperAdminRequest(req)) {
    throw createActionError("Somente superadmin pode excluir usuarios.", 403);
  }

  const normalizedId = ensureAccessUserId(id);
  const usuarioAtual = await Usuario.findById(normalizedId)
    .select("_id perfil tipoCadastro")
    .lean();
  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  if (!["familia", "voluntario"].includes(String(usuarioAtual.tipoCadastro || "").toLowerCase())) {
    throw createActionError("Exclusao permitida apenas para familia e voluntario.", 403);
  }

  if (!canManageTargetUser(req, usuarioAtual)) {
    throw createActionError("Somente superadmin pode excluir outro superadmin.", 403);
  }

  const usuario = await UsuarioService.remover(normalizedId, { usuarioId: actorId });
  if (!usuario) {
    throw createActionError("Usuario nao encontrado.");
  }

  return {
    usuario,
    successMessage: "Usuario excluido com sucesso.",
    audit: {
      acao: "USUARIO_INATIVADO",
      entidade: "usuario",
      entidadeId: normalizedId,
    },
  };
}

function formatDateBR(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatDateOnlyBR(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatCpfDisplay(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11) return value || "-";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

async function buildUserFichaPagePayload(id, req = null) {
  const normalizedId = ensureAccessUserId(id);
  const usuario = await Usuario.findById(normalizedId).select("-senha").lean();

  if (!usuario) return null;

  const actorId = req?.session?.user?.id || null;
  const approvalDetail = await mapApprovalDetail(usuario, actorId);

  const tipoCadastro = String(usuario.tipoCadastro || "").toLowerCase();
  const isVolunteer = tipoCadastro === "voluntario";

  const backPath = tipoCadastro === "familia" ? "/acessos/familias" : "/acessos/voluntarios";
  const backLabel = tipoCadastro === "familia" ? "Voltar para familias" : "Voltar para voluntarios";

  const canEdit = req
    ? canManageUsers(req) && canManageTargetUser(req, usuario)
    : false;
  const canAdminister = req ? isAdmin(req) : false;
  const canViewDocuments = req ? canReviewSensitiveApprovalData(req) : false;

  return {
    ...approvalDetail,
    telefone: usuario.telefone || "-",
    cpf: formatCpfDisplay(usuario.cpf),
    dataNascimento: formatDateOnlyBR(usuario.dataNascimento),
    perfil: usuario.perfil || "",
    perfilLabel: getProfileLabel(usuario.perfil),
    createdAtFormatted: formatDateBR(usuario.createdAt),
    updatedAtFormatted: formatDateBR(usuario.updatedAt),
    ultimoLogin: formatDateBR(usuario.ultimoLoginEm),
    isVolunteer,
    backPath,
    backLabel,
    canEdit,
    canAdminister,
    canViewDocuments,
  };
}

module.exports = {
  loadApprovalDetailPayload,
  loadProtectedApprovalAsset,
  buildUserFichaPagePayload,
  approveUserAccess,
  rejectUserAccess,
  changeUserAccessStatus,
  removeUserAccess,
};
