const Usuario = require("../../../schemas/core/Usuario");
const UsuarioService = require("../../../services/domain/UsuarioService");
const { PERFIS } = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const {
  VOLUNTARIO_ACCESS_OPTIONS,
  normalizeVolunteerAccessLevel,
  getVolunteerAccessLabel,
} = require("../../../config/volunteerAccess");
const {
  APPROVAL_ROLES,
  normalizeApprovalRole,
} = require("../../../config/approvalRoles");
const {
  hasAnyPermission,
  resolvePermissionsForUserId,
} = require("../../shared/accessControlService");
const {
  perfilLabel,
  statusLabel,
  tipoLabel,
} = require("./accessPresentationService");
const {
  sanitizeProtectedAttachmentBundleForClient,
} = require("../../security/secureVolunteerAssetService");

function shouldUseVotingFlow(usuario) {
  return false;
}

function normalizeApprovalVotes(votos = []) {
  if (!Array.isArray(votos)) return [];

  return votos
    .filter((item) => item && item.adminId && item.decisao)
    .map((item) => ({
      adminId: String(item.adminId),
      decisao: String(item.decisao).trim().toLowerCase() === "rejeitar" ? "rejeitar" : "aprovar",
      motivo: String(item.motivo || "").trim(),
      nivelAcessoVoluntario: normalizeVolunteerAccessLevel(item.nivelAcessoVoluntario, null),
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null,
    }));
}

function summarizeApprovalVotes(votos = [], actorId = null, presidentId = null) {
  const normalized = normalizeApprovalVotes(votos);
  const actorVote = normalized.find((item) => String(item.adminId) === String(actorId || ""));
  const aprovar = normalized.filter((item) => item.decisao === "aprovar").length;
  const rejeitar = normalized.filter((item) => item.decisao === "rejeitar").length;
  const presidentVote = normalized.find((item) => String(item.adminId) === String(presidentId || ""));

  return {
    aprovar,
    rejeitar,
    total: aprovar + rejeitar,
    actorVote: actorVote?.decisao || "",
    actorLevelVote: actorVote?.nivelAcessoVoluntario || "",
    presidentVote: presidentVote?.decisao || "",
  };
}

function upsertApprovalVote(votos = [], actorId, decisao, extras = {}) {
  const normalized = normalizeApprovalVotes(votos);
  const adminId = String(actorId || "").trim();
  if (!adminId) return normalized;

  const voteDecision = String(decisao || "").trim().toLowerCase() === "rejeitar" ? "rejeitar" : "aprovar";
  const motivo = voteDecision === "rejeitar" ? String(extras?.motivo || "").trim() : "";
  const nivelAcessoVoluntario =
    voteDecision === "aprovar"
      ? normalizeVolunteerAccessLevel(extras?.nivelAcessoVoluntario, null)
      : null;
  const now = new Date();
  const nextVotes = normalized.filter((item) => String(item.adminId) !== adminId);

  nextVotes.push({
    adminId,
    decisao: voteDecision,
    motivo,
    nivelAcessoVoluntario,
    createdAt: now,
    updatedAt: now,
  });

  return nextVotes;
}

function countDecisionVotes(votos = []) {
  const normalized = normalizeApprovalVotes(votos);
  return {
    aprovar: normalized.filter((item) => item.decisao === "aprovar").length,
    rejeitar: normalized.filter((item) => item.decisao === "rejeitar").length,
  };
}

function buildLevelVoteSummary(votos = []) {
  const normalized = normalizeApprovalVotes(votos);
  const countsByLevel = new Map(
    VOLUNTARIO_ACCESS_OPTIONS.map((option) => [option.value, 0])
  );

  normalized
    .filter((item) => item.decisao === "aprovar" && item.nivelAcessoVoluntario)
    .forEach((item) => {
      const current = Number(countsByLevel.get(item.nivelAcessoVoluntario) || 0);
      countsByLevel.set(item.nivelAcessoVoluntario, current + 1);
    });

  const entries = VOLUNTARIO_ACCESS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    count: Number(countsByLevel.get(option.value) || 0),
  }));

  const maxCount = Math.max(...entries.map((item) => item.count), 0);
  const leaders = entries
    .filter((item) => item.count > 0 && item.count === maxCount)
    .map((item) => item.value);

  return entries.map((item) => ({
    ...item,
    isLeader: item.count > 0 && item.count === maxCount,
    isTiedLeader: leaders.length > 1 && leaders.includes(item.value),
  }));
}

async function resolveApprovalElectorate() {
  return {
    approvers: [],
    president: null,
    presidentId: "",
    regularApprovers: [],
    totalApprovers: 0,
    totalRegularApprovers: 0,
  };
}

function pickLeadingLevels(levelVotes = []) {
  const maxCount = Math.max(...levelVotes.map((item) => Number(item.count || 0)), 0);
  if (maxCount <= 0) return [];
  return levelVotes.filter((item) => Number(item.count || 0) === maxCount);
}

function buildApprovalWorkflowSummary(usuario, electorate) {
  const doc = usuario?.toObject ? usuario.toObject() : usuario || {};
  const status = String(doc?.statusAprovacao || "aprovado").trim().toLowerCase();
  const isVolunteer = String(doc?.tipoCadastro || "").toLowerCase() === "voluntario";
  const level = isVolunteer ? normalizeVolunteerAccessLevel(doc?.nivelAcessoVoluntario, null) : null;

  const stateByStatus = {
    pendente: "Aguardando decisão do administrador",
    aprovado: "Aprovado por administrador",
    rejeitado: "Rejeitado por administrador",
  };

  return {
    stateKey: status,
    stateLabel: stateByStatus[status] || "Status de aprovação",
    finalDecision: status === "aprovado" || status === "rejeitado" ? status : "",
    finalLevel: level || "",
    requiresPresidentDecision: false,
    isResolved: status !== "pendente" && (!isVolunteer || !!level),
    president: null,
    presidentVote: null,
    totalApprovers: 1,
    totalRegularApprovers: 1,
    regularMajorityThreshold: 1,
    regularVotesReceived: 0,
    pendingRegularVotes: status === "pendente" ? 1 : 0,
    pendingRegularApproverNames: [],
    decisionCountsRegular: { aprovar: status === "aprovado" ? 1 : 0, rejeitar: status === "rejeitado" ? 1 : 0 },
    levelVotes: isVolunteer && level
      ? [{ value: level, label: getVolunteerAccessLabel(level), count: 1, isLeader: true, isTiedLeader: false }]
      : [],
    leaderLevel: isVolunteer && level
      ? { value: level, label: getVolunteerAccessLabel(level), count: 1, isLeader: true, isTiedLeader: false }
      : null,
    finalLevelLabel: getVolunteerAccessLabel(level),
    presidentReason: String(doc?.motivoAprovacao || "").trim(),
    resolvedByPresident: false,
    resolvedLevelByPresident: false,
  };
}

async function buildRejectReasonCards(usuario) {
  const doc = usuario?.toObject ? usuario.toObject() : usuario;
  const votos = normalizeApprovalVotes(doc?.votosAprovacao);
  const rejectedVotes = votos
    .filter((item) => item.decisao === "rejeitar" && item.motivo)
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  const adminIds = [...new Set(rejectedVotes.map((item) => String(item.adminId || "")).filter(Boolean))];
  const admins = adminIds.length
    ? await Usuario.find({ _id: { $in: adminIds } }).select("_id nome").lean()
    : [];
  const adminNameById = new Map(
    admins.map((item) => [String(item._id), String(item.nome || "Administrador").trim() || "Administrador"])
  );

  const cards = rejectedVotes.map((item) => ({
    adminId: String(item.adminId || ""),
    adminNome: adminNameById.get(String(item.adminId || "")) || "Administrador",
    motivo: String(item.motivo || "").trim(),
    updatedAt: item.updatedAt || item.createdAt || null,
  }));

  if (!cards.length && doc?.motivoAprovacao) {
    return [
      {
        adminId: "",
        adminNome: "Administrador",
        motivo: String(doc.motivoAprovacao || "").trim(),
        updatedAt: doc?.updatedAt || null,
      },
    ];
  }

  return cards;
}

function buildSignupSummary(dadosCadastro) {
  const source = normalizeSignupDataSource(dadosCadastro);

  return {
    data_nascimento: String(
      source?.data_nascimento || source?.dataNascimento || source?.nascimento || ""
    ).trim(),
    funcao_na_ong: String(
      source?.funcao_na_ong || source?.funcaoNaOng || source?.funcao || ""
    ).trim(),
  };
}

function normalizeSignupDataSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value instanceof Map ? Object.fromEntries(value.entries()) : value;
  const normalized = { ...source };

  // Mantem compatibilidade entre chaves antigas e novas do fluxo de voluntarios.
  const aliases = [
    ["funcao_na_ong", ["funcaoNaOng", "funcao"]],
    ["funcao", ["funcao_na_ong", "funcaoNaOng"]],
    ["data_nascimento", ["dataNascimento", "nascimento"]],
    ["telefone", ["celular", "whatsapp"]],
  ];

  aliases.forEach(([targetKey, sourceKeys]) => {
    const directValue = String(normalized?.[targetKey] ?? "").trim();
    if (directValue) return;

    const fallback = sourceKeys
      .map((key) => String(source?.[key] ?? "").trim())
      .find(Boolean);

    if (fallback) {
      normalized[targetKey] = fallback;
    }
  });

  return normalized;
}

function suggestVolunteerAccessLevelFromSignup(dadosCadastro) {
  const source = normalizeSignupDataSource(dadosCadastro);
  const funcaoRaw = String(
    source?.funcao_na_ong || source?.funcao || source?.funcaoNaOng || ""
  )
    .trim()
    .toLowerCase();

  if (!funcaoRaw) return "";

  if (funcaoRaw.includes("servico social")) return "servico_social";
  if (funcaoRaw.includes("captacao")) return "captacao";
  if (funcaoRaw.includes("diretoria") || funcaoRaw.includes("diretor")) return "diretoria";

  return "voluntario_atendimento";
}

function formatSignupFieldLabel(key) {
  const normalized = String(key || "").trim().toLowerCase();
  const aliases = {
    area_atuacao: "Area de atuacao",
    carga_horaria: "Carga horaria",
    cpf: "CPF",
    data_nascimento: "Data de nascimento",
    descricao_atividade: "Descricao da atividade",
    faixa_etaria: "Faixa etaria",
    funcao: "Funcao",
    funcao_na_ong: "Funcao na ONG",
    metodologia: "Metodologia",
    nome_atividade: "Nome da atividade",
    objetivo_geral: "Objetivo geral",
    objetivos_especificos: "Objetivos especificos",
    participantes_por_turma: "Participantes por turma",
    perfil_participantes: "Perfil dos participantes",
    publico_alvo: "Publico-alvo",
    telefone: "Telefone",
  };

  if (aliases[normalized]) return aliases[normalized];

  return String(key || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function buildSignupFields(dadosCadastro) {
  const source = normalizeSignupDataSource(dadosCadastro);
  const seenCanonicalKeys = new Set();

  return Object.entries(source)
    .map(([key, value]) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey) return null;

      const canonicalKey = (() => {
        if (["funcao", "funcao_na_ong", "funcaoNaOng"].includes(normalizedKey)) {
          return "funcao_na_ong";
        }
        if (["dataNascimento", "nascimento", "data_nascimento"].includes(normalizedKey)) {
          return "data_nascimento";
        }
        return normalizedKey;
      })();

      if (seenCanonicalKeys.has(canonicalKey)) {
        return null;
      }

      const text = Array.isArray(value)
        ? value.map((item) => String(item || "").trim()).filter(Boolean).join(", ")
        : String(value ?? "").trim();

      if (!text) return null;
      seenCanonicalKeys.add(canonicalKey);

      return {
        key: canonicalKey,
        label: formatSignupFieldLabel(canonicalKey),
        value: text,
      };
    })
    .filter(Boolean);
}

async function mapApprovalDetail(usuario, actorId = null, electorate = null) {
  const doc = usuario?.toObject ? usuario.toObject() : usuario;
  const workflowResumo = buildApprovalWorkflowSummary(doc);
  const presidentId = "";
  const rejeicoesComMotivo = await buildRejectReasonCards(doc);
  const attachments = sanitizeProtectedAttachmentBundleForClient(doc?.anexosProtegidos || {});
  const dadosCadastroResumo = buildSignupSummary(doc?.dadosCadastro);
  const dadosCadastroCampos = buildSignupFields(doc?.dadosCadastro);
  const nivelAcessoVoluntarioSugerido = suggestVolunteerAccessLevelFromSignup(doc?.dadosCadastro);
  const userId = String(doc?._id || "").trim();

  if (attachments.documentoIdentidade) {
    attachments.documentoIdentidade.viewUrl = `/acessos/${userId}/anexos/documentoIdentidade`;
  }

  if (attachments.fotoPerfil) {
    attachments.fotoPerfil.viewUrl = `/acessos/${userId}/anexos/fotoPerfil`;
  }

  return {
    _id: doc?._id,
    nome: doc?.nome || "",
    email: doc?.email || "",
    login: doc?.login || "",
    tipoCadastro: doc?.tipoCadastro || "",
    tipoCadastroLabel: tipoLabel(doc?.tipoCadastro),
    statusAprovacao: doc?.statusAprovacao || "",
    statusAprovacaoLabel: statusLabel(doc?.statusAprovacao),
    nivelAcessoVoluntario: doc?.nivelAcessoVoluntario || "",
    nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(doc?.nivelAcessoVoluntario),
    nivelAcessoVoluntarioSugerido,
    nivelAcessoVoluntarioSugeridoLabel: getVolunteerAccessLabel(nivelAcessoVoluntarioSugerido),
    motivoAprovacao: doc?.motivoAprovacao || "",
    ativo: !!doc?.ativo,
    dadosCadastro: dadosCadastroResumo,
    dadosCadastroResumo,
    dadosCadastroCampos,
    anexosProtegidos: attachments,
    votosResumo: summarizeApprovalVotes(doc?.votosAprovacao, actorId, presidentId),
    workflowResumo,
    rejeicoesComMotivo,
  };
}

async function tryFinalizeApprovalDecision(usuarioId, actorId = null, electorate = null) {
  const usuario = await Usuario.findById(usuarioId).select("-senha").lean();
  return {
    usuario,
    workflowResumo: buildApprovalWorkflowSummary(usuario),
    finalized: false,
  };
}

module.exports = {
  shouldUseVotingFlow,
  normalizeApprovalVotes,
  summarizeApprovalVotes,
  upsertApprovalVote,
  resolveApprovalElectorate,
  buildApprovalWorkflowSummary,
  buildRejectReasonCards,
  mapApprovalDetail,
  tryFinalizeApprovalDecision,
};
