const Usuario = require("../../../schemas/core/Usuario");
const UsuarioService = require("../../domain/UsuarioService");
const {
  getVolunteerAccessLabel,
  normalizeVolunteerAccessLevel,
} = require("../../../config/volunteerAccess");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { canManageTargetUser } = require("./accessPermissionService");
const {
  buildApprovalWorkflowSummary,
  mapApprovalDetail,
  normalizeApprovalVotes,
  resolveApprovalElectorate,
  shouldUseVotingFlow,
  tryFinalizeApprovalDecision,
  upsertApprovalVote,
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

async function loadApprovalDetailPayload(id, actorId = null) {
  const normalizedId = ensureAccessUserId(id);
  const electorate = await resolveApprovalElectorate();
  const usuario = await UsuarioService.buscarPorId(normalizedId);

  if (!usuario) {
    return null;
  }

  return mapApprovalDetail(usuario, actorId, electorate);
}

async function approveUserAccess({ id, actorId = null, body = {} }) {
  const normalizedId = ensureAccessUserId(id);
  const usuarioAtual = await Usuario.findById(normalizedId)
    .select("_id nome perfil tipoCadastro statusAprovacao votosAprovacao nivelAcessoVoluntario")
    .lean();

  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  if (shouldUseVotingFlow(usuarioAtual)) {
    throw createActionError("Esse cadastro deve ser decidido pela fila de votacao em Aprovações.");
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
    votosAprovacao: upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, "aprovar", {
      nivelAcessoVoluntario,
    }),
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
    .select("_id nome perfil statusAprovacao votosAprovacao")
    .lean();

  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  if (shouldUseVotingFlow(usuarioAtual)) {
    throw createActionError("Esse cadastro deve ser decidido pela fila de votacao em Aprovações.");
  }

  const usuario = await UsuarioService.atualizar(
    normalizedId,
    {
      statusAprovacao: "rejeitado",
      motivoAprovacao: motivo,
      ativo: false,
      nivelAcessoVoluntario: null,
      votosAprovacao: upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, "rejeitar", { motivo }),
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

async function voteUserApproval({
  id,
  actorId = null,
  decisao,
  motivo = "",
  nivelAcessoVoluntarioInput = null,
}) {
  const normalizedDecision = String(decisao || "").trim().toLowerCase();
  if (!["aprovar", "rejeitar"].includes(normalizedDecision)) {
    throw createActionError("Vote em aprovar ou rejeitar.");
  }

  const normalizedId = ensureAccessUserId(id);
  const electorate = await resolveApprovalElectorate();
  const usuarioAtual = await Usuario.findById(normalizedId)
    .select("_id nome statusAprovacao votosAprovacao tipoCadastro nivelAcessoVoluntario")
    .lean();

  if (!usuarioAtual) {
    throw createActionError("Usuario nao encontrado.");
  }

  if (String(usuarioAtual.statusAprovacao || "").toLowerCase() !== "pendente") {
    throw createActionError("Somente cadastros pendentes podem receber votos.");
  }

  const votosAtuais = normalizeApprovalVotes(usuarioAtual.votosAprovacao);
  const votoAtualDoAtor = votosAtuais.find((item) => String(item.adminId) === String(actorId || ""));

  const payload = {
    votosAprovacao: [],
  };

  if (normalizedDecision === "aprovar" && usuarioAtual.tipoCadastro === "voluntario") {
    const nivelAcessoVoluntario = normalizeVolunteerAccessLevel(
      nivelAcessoVoluntarioInput || votoAtualDoAtor?.nivelAcessoVoluntario,
      null
    );

    if (!nivelAcessoVoluntario) {
      throw createActionError("Abra a ficha do voluntario e escolha o nivel de acesso antes de votar para aprovar.");
    }

    payload.votosAprovacao = upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, normalizedDecision, {
      motivo,
      nivelAcessoVoluntario,
    });
  } else {
    payload.votosAprovacao = upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, normalizedDecision, {
      motivo,
    });
  }

  const usuario = await UsuarioService.atualizar(normalizedId, payload, { usuarioId: actorId });
  if (!usuario) {
    throw createActionError("Usuario nao encontrado.");
  }

  const finalizeResult = await tryFinalizeApprovalDecision(normalizedId, actorId, electorate);

  if (finalizeResult.finalized && finalizeResult.usuario) {
    return {
      usuario: finalizeResult.usuario,
      successMessage:
        finalizeResult.workflowResumo?.finalDecision === "aprovar"
          ? `Voto registrado e cadastro aprovado automaticamente${finalizeResult.workflowResumo?.finalLevel ? ` como ${getVolunteerAccessLabel(finalizeResult.workflowResumo.finalLevel)}` : ""}.`
          : "Voto registrado e cadastro rejeitado automaticamente.",
      audit: {
        acao:
          finalizeResult.workflowResumo?.finalDecision === "aprovar"
            ? "USUARIO_APROVACAO_AUTOMATICA"
            : "USUARIO_REJEICAO_AUTOMATICA",
        entidade: "usuario",
        entidadeId: normalizedId,
        detalhes: {
          nivelAcessoVoluntario: finalizeResult.workflowResumo?.finalLevel || "",
          stateLabel: finalizeResult.workflowResumo?.stateLabel || "",
        },
      },
    };
  }

  const workflowResumo = buildApprovalWorkflowSummary(usuario, electorate);

  return {
    usuario,
    successMessage: `Voto registrado. ${workflowResumo.stateLabel}.`,
    audit: {
      acao: normalizedDecision === "aprovar" ? "USUARIO_VOTO_APROVACAO" : "USUARIO_VOTO_REJEICAO",
      entidade: "usuario",
      entidadeId: normalizedId,
      detalhes: {
        decisao: normalizedDecision,
        totalVotos: payload.votosAprovacao.length,
        motivo: motivo || "",
        nivelAcessoVoluntario:
          payload.votosAprovacao.find((item) => String(item.adminId) === String(actorId || ""))?.nivelAcessoVoluntario || "",
      },
    },
  };
}

module.exports = {
  loadApprovalDetailPayload,
  approveUserAccess,
  rejectUserAccess,
  changeUserAccessStatus,
  voteUserApproval,
};
