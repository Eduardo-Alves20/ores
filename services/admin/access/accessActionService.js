const Usuario = require("../../../schemas/core/Usuario");
const UsuarioService = require("../../domain/UsuarioService");
const {
  getVolunteerAccessLabel,
  normalizeVolunteerAccessLevel,
} = require("../../../config/volunteerAccess");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { canManageTargetUser } = require("./accessPermissionService");
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

module.exports = {
  loadApprovalDetailPayload,
  loadProtectedApprovalAsset,
  approveUserAccess,
  rejectUserAccess,
  changeUserAccessStatus,
};
