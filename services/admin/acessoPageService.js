const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../../services/domain/UsuarioService");
const {
  PERFIS,
  getProfileLabel,
  isAdminProfile,
} = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const {
  VOLUNTARIO_ACCESS_OPTIONS,
  normalizeVolunteerAccessLevel,
  getVolunteerAccessLabel,
} = require("../../config/volunteerAccess");
const {
  APPROVAL_ROLES,
  normalizeApprovalRole,
  getApprovalRoleLabel,
} = require("../../config/approvalRoles");
const {
  hasAnyPermission,
  resolvePermissionsForUserId,
} = require("../../services/accessControlService");
const { parseBoolean } = require("../shared/valueParsingService");
const { escapeRegex } = require("../shared/searchUtilsService");

function parseStatus(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "pendente" || raw === "aprovado" || raw === "rejeitado") return raw;
  return fallback;
}

function parseTipo(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "familia" || raw === "voluntario") return raw;
  return fallback;
}

function parsePage(value, fallback = 1) {
  return Math.max(Number.parseInt(String(value || ""), 10) || fallback, 1);
}

function parseLimit(value, fallback = 20) {
  const allowed = new Set([10, 20, 50, 100]);
  const parsed = Number.parseInt(String(value || ""), 10);
  if (allowed.has(parsed)) return parsed;
  return fallback;
}

function isAdmin(req) {
  const user = req?.session?.user || {};
  if (isAdminProfile(user.perfil)) return true;
  return hasAnyPermission(user.permissions || [], [PERMISSIONS.ACESSOS_APPROVE]);
}

function canManageUsers(req) {
  const user = req?.session?.user || {};
  const perfil = String(user.perfil || "").toLowerCase();
  if (perfil === PERFIS.SUPERADMIN) return true;
  return hasAnyPermission(user.permissions || [], [PERMISSIONS.USUARIOS_MANAGE]);
}

function isSuperAdminRequest(req) {
  return String(req?.session?.user?.perfil || "").toLowerCase() === PERFIS.SUPERADMIN;
}

function canManageTargetUser(req, usuario) {
  const perfilAlvo = String(usuario?.perfil || "").toLowerCase();
  if (perfilAlvo !== PERFIS.SUPERADMIN) return true;
  return isSuperAdminRequest(req);
}

function buildCreateProfileOptions(req) {
  const user = req?.session?.user || {};
  const perfilAtual = String(user.perfil || "").toLowerCase();
  const options = [
    { value: PERFIS.USUARIO, label: "Usuario do Portal" },
    { value: PERFIS.ATENDENTE, label: "Atendente" },
    { value: PERFIS.TECNICO, label: "Tecnico" },
    { value: PERFIS.ADMIN, label: "admin_alento" },
  ];

  if (perfilAtual === PERFIS.SUPERADMIN) {
    options.push({ value: PERFIS.SUPERADMIN, label: "SuperAdmin" });
  }

  return options;
}

function buildApprovalRoleOptions() {
  return [
    { value: APPROVAL_ROLES.MEMBRO, label: getApprovalRoleLabel(APPROVAL_ROLES.MEMBRO) },
    { value: APPROVAL_ROLES.PRESIDENTE, label: getApprovalRoleLabel(APPROVAL_ROLES.PRESIDENTE) },
  ];
}

function resolveReturnTo(rawValue, fallbackPath) {
  const raw = String(rawValue || "").trim();
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  if (!raw.startsWith("/acessos/")) return fallbackPath;
  return raw;
}

function statusLabel(statusAprovacao) {
  const value = String(statusAprovacao || "aprovado").toLowerCase();
  if (value === "aprovado") return "Aprovado";
  if (value === "rejeitado") return "Rejeitado";
  return "Pendente";
}

function statusClass(statusAprovacao) {
  const value = String(statusAprovacao || "aprovado").toLowerCase();
  if (value === "aprovado") return "status-active";
  if (value === "rejeitado") return "status-inactive";
  return "status-pending";
}

function perfilLabel(perfil) {
  return getProfileLabel(perfil);
}

function tipoLabel(tipoCadastro) {
  return String(tipoCadastro || "").toLowerCase() === "familia" ? "Familia" : "Voluntario";
}

function shouldUseVotingFlow(usuario) {
  const perfil = String(usuario?.perfil || "").trim().toLowerCase();
  const statusAprovacao = String(usuario?.statusAprovacao || "").trim().toLowerCase();
  return perfil === PERFIS.USUARIO && statusAprovacao === "pendente";
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
  const candidates = await Usuario.find({
    ativo: true,
    $or: [
      { perfil: { $ne: PERFIS.USUARIO } },
      { funcoesAcesso: { $exists: true, $ne: [] } },
    ],
  })
    .select("_id nome email login perfil papelAprovacao")
    .lean();

  const candidatesWithPermissions = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      permissions: await resolvePermissionsForUserId(candidate._id, candidate.perfil),
    }))
  );

  const approvers = candidatesWithPermissions
    .filter(
      ({ candidate, permissions }) =>
        String(candidate.perfil || "").toLowerCase() === PERFIS.SUPERADMIN ||
        hasAnyPermission(permissions, [PERMISSIONS.ACESSOS_APPROVE])
    )
    .map(({ candidate }) => ({
      _id: String(candidate._id),
      nome: String(candidate.nome || "").trim() || String(candidate.email || "").trim() || "Administrador",
      email: String(candidate.email || "").trim(),
      login: String(candidate.login || "").trim(),
      perfil: String(candidate.perfil || "").trim(),
      papelAprovacao: normalizeApprovalRole(candidate.papelAprovacao, APPROVAL_ROLES.MEMBRO),
      hasExplicitApprovalRole: !!candidate.papelAprovacao,
    }));

  const explicitApprovers = approvers.filter((item) => item.hasExplicitApprovalRole);
  const activeApprovers = explicitApprovers.length ? explicitApprovers : approvers;

  activeApprovers.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const envPresidentLogin = String(process.env.PRESIDENT_LOGIN || process.env.DEMO_PRESIDENT_LOGIN || "")
    .trim()
    .toLowerCase();
  const envPresidentEmail = String(process.env.PRESIDENT_EMAIL || process.env.DEMO_PRESIDENT_EMAIL || "")
    .trim()
    .toLowerCase();

  const president =
    activeApprovers.find((item) => item.papelAprovacao === APPROVAL_ROLES.PRESIDENTE) ||
    activeApprovers.find(
      (item) =>
        (envPresidentLogin && String(item.login || "").toLowerCase() === envPresidentLogin) ||
        (envPresidentEmail && String(item.email || "").toLowerCase() === envPresidentEmail)
    ) ||
    activeApprovers.find((item) => String(item.perfil || "").toLowerCase() === PERFIS.SUPERADMIN) ||
    activeApprovers.find((item) => String(item.perfil || "").toLowerCase() === PERFIS.ADMIN) ||
    null;

  const presidentId = president?._id ? String(president._id) : "";
  const regularApprovers = activeApprovers.filter((item) => String(item._id) !== presidentId);

  return {
    approvers: activeApprovers,
    president,
    presidentId,
    regularApprovers,
    totalApprovers: activeApprovers.length,
    totalRegularApprovers: regularApprovers.length,
  };
}

function pickLeadingLevels(levelVotes = []) {
  const maxCount = Math.max(...levelVotes.map((item) => Number(item.count || 0)), 0);
  if (maxCount <= 0) return [];
  return levelVotes.filter((item) => Number(item.count || 0) === maxCount);
}

function buildApprovalWorkflowSummary(usuario, electorate) {
  const doc = usuario?.toObject ? usuario.toObject() : usuario;
  const votos = normalizeApprovalVotes(doc?.votosAprovacao);
  const presidentId = String(electorate?.presidentId || "");
  const regularIds = (electorate?.regularApprovers || []).map((item) => String(item._id));
  const regularVotes = votos.filter((item) => regularIds.includes(String(item.adminId)));
  const presidentVote = presidentId ? votos.find((item) => String(item.adminId) === presidentId) || null : null;
  const pendingRegularApprovers = (electorate?.regularApprovers || []).filter(
    (item) => !regularVotes.some((vote) => String(vote.adminId) === String(item._id))
  );
  const regularDecisionCounts = countDecisionVotes(regularVotes);
  const levelVotesAll = buildLevelVoteSummary(votos);
  const levelVotesRegular = buildLevelVoteSummary(regularVotes);
  const levelVoteByValue = new Map(levelVotesAll.map((item) => [item.value, item]));
  const leadingRegularLevels = pickLeadingLevels(levelVotesRegular);
  const leadingAllLevels = pickLeadingLevels(levelVotesAll);
  const isVolunteer = String(doc?.tipoCadastro || "").toLowerCase() === "voluntario";
  const totalRegularApprovers = Number(electorate?.totalRegularApprovers || 0);
  const regularMajorityThreshold = totalRegularApprovers > 0
    ? Math.floor(totalRegularApprovers / 2) + 1
    : 1;

  let stateKey = "coletando_votos";
  let stateLabel = "Coletando votos";
  let finalDecision = "";
  let finalLevel = "";
  let requiresPresidentDecision = false;
  let presidentReason = "";
  let leaderLevel = leadingRegularLevels.length === 1 ? leadingRegularLevels[0] : null;
  let resolvedByPresident = false;
  let resolvedLevelByPresident = false;

  if (regularIds.length === 0) {
    if (presidentVote) {
      finalDecision = presidentVote.decisao;
      resolvedByPresident = true;
      if (finalDecision === "aprovar" && isVolunteer) {
        finalLevel = presidentVote.nivelAcessoVoluntario || "";
        if (!finalLevel) {
          requiresPresidentDecision = true;
          stateKey = "aguardando_presidente";
          stateLabel = "Aguardando decisao do presidente";
        }
      }
    } else if (electorate?.president) {
      requiresPresidentDecision = true;
      stateKey = "aguardando_presidente";
      stateLabel = "Aguardando decisao do presidente";
    }
  } else if (regularDecisionCounts.aprovar >= regularMajorityThreshold) {
    finalDecision = "aprovar";
  } else if (regularDecisionCounts.rejeitar >= regularMajorityThreshold) {
    finalDecision = "rejeitar";
  } else if (pendingRegularApprovers.length > 0) {
    stateKey = "coletando_votos";
    stateLabel = "Coletando votos";
  } else if (presidentVote) {
    finalDecision = presidentVote.decisao;
    resolvedByPresident = true;
  } else {
    requiresPresidentDecision = true;
    stateKey = "aguardando_presidente";
    stateLabel = "Empate de aprovacao: aguardando presidente";
  }

  if (finalDecision === "aprovar" && isVolunteer) {
    if (leaderLevel && !leaderLevel.isTiedLeader) {
      finalLevel = leaderLevel.value;
    } else if (presidentVote?.decisao === "aprovar" && presidentVote?.nivelAcessoVoluntario) {
      finalLevel = presidentVote.nivelAcessoVoluntario;
      resolvedLevelByPresident = true;
      leaderLevel = levelVoteByValue.get(finalLevel) || {
        value: finalLevel,
        label: getVolunteerAccessLabel(finalLevel),
        count: 1,
        isLeader: true,
        isTiedLeader: false,
      };
    } else {
      requiresPresidentDecision = true;
      finalDecision = "";
      stateKey = "aguardando_presidente";
      stateLabel = "Empate de nivel: aguardando presidente";
    }
  }

  if (!leaderLevel && leadingAllLevels.length === 1) {
    leaderLevel = leadingAllLevels[0];
  }

  if (!leaderLevel && finalLevel) {
    leaderLevel = levelVoteByValue.get(finalLevel) || {
      value: finalLevel,
      label: getVolunteerAccessLabel(finalLevel),
      count: 0,
      isLeader: true,
      isTiedLeader: false,
    };
  }

  if (finalDecision === "aprovar" && !requiresPresidentDecision) {
    stateKey = "decisao_automatica";
    stateLabel = resolvedByPresident || resolvedLevelByPresident
      ? "Aprovado com decisao do presidente"
      : "Aprovado automaticamente";
  }

  if (finalDecision === "rejeitar" && !requiresPresidentDecision) {
    stateKey = "decisao_automatica";
    stateLabel = resolvedByPresident
      ? "Rejeitado com decisao do presidente"
      : "Rejeitado automaticamente";
  }

  if (finalDecision === "rejeitar") {
    const latestRejectVote = [...votos]
      .filter((item) => item.decisao === "rejeitar" && item.motivo)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0];
    presidentReason = String(presidentVote?.motivo || latestRejectVote?.motivo || "").trim();
  }

  return {
    stateKey,
    stateLabel,
    finalDecision,
    finalLevel,
    requiresPresidentDecision,
    isResolved: !!finalDecision && (!isVolunteer || !!finalLevel),
    president: electorate?.president
      ? {
          id: String(electorate.president._id || ""),
          nome: electorate.president.nome,
          papelAprovacao: electorate.president.papelAprovacao,
        }
      : null,
    presidentVote,
    totalApprovers: Number(electorate?.totalApprovers || 0),
    totalRegularApprovers,
    regularMajorityThreshold,
    regularVotesReceived: regularVotes.length,
    pendingRegularVotes: pendingRegularApprovers.length,
    pendingRegularApproverNames: pendingRegularApprovers.map((item) => item.nome),
    decisionCountsRegular: regularDecisionCounts,
    levelVotes: levelVotesAll,
    leaderLevel,
    finalLevelLabel: getVolunteerAccessLabel(finalLevel),
    presidentReason,
    resolvedByPresident,
    resolvedLevelByPresident,
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

async function mapApprovalDetail(usuario, actorId = null, electorate = null) {
  const doc = usuario?.toObject ? usuario.toObject() : usuario;
  const resolvedElectorate = electorate || (await resolveApprovalElectorate());
  const workflowResumo = buildApprovalWorkflowSummary(doc, resolvedElectorate);
  const presidentId = String(workflowResumo?.president?.id || "");
  const rejeicoesComMotivo = await buildRejectReasonCards(doc);

  return {
    _id: doc?._id,
    nome: doc?.nome || "",
    email: doc?.email || "",
    login: doc?.login || "",
    telefone: doc?.telefone || "",
    cpf: doc?.cpf || "",
    perfil: doc?.perfil || "",
    perfilLabel: perfilLabel(doc?.perfil),
    tipoCadastro: doc?.tipoCadastro || "",
    tipoCadastroLabel: tipoLabel(doc?.tipoCadastro),
    statusAprovacao: doc?.statusAprovacao || "",
    statusAprovacaoLabel: statusLabel(doc?.statusAprovacao),
    nivelAcessoVoluntario: doc?.nivelAcessoVoluntario || "",
    nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(doc?.nivelAcessoVoluntario),
    motivoAprovacao: doc?.motivoAprovacao || "",
    ativo: !!doc?.ativo,
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
    votosResumo: summarizeApprovalVotes(doc?.votosAprovacao, actorId, presidentId),
    workflowResumo,
    rejeicoesComMotivo,
  };
}

async function tryFinalizeApprovalDecision(usuarioId, actorId = null, electorate = null) {
  const usuario = await Usuario.findById(usuarioId)
    .select("-senha")
    .lean();

  if (!usuario) {
    return { usuario: null, workflowResumo: null, finalized: false };
  }

  const resolvedElectorate = electorate || (await resolveApprovalElectorate());
  const workflowResumo = buildApprovalWorkflowSummary(usuario, resolvedElectorate);

  if (!workflowResumo.isResolved || String(usuario.statusAprovacao || "").toLowerCase() !== "pendente") {
    return { usuario, workflowResumo, finalized: false };
  }

  const payload =
    workflowResumo.finalDecision === "aprovar"
      ? {
          statusAprovacao: "aprovado",
          ativo: true,
          motivoAprovacao: "",
          nivelAcessoVoluntario:
            String(usuario.tipoCadastro || "").toLowerCase() === "voluntario"
              ? workflowResumo.finalLevel
              : null,
        }
      : {
          statusAprovacao: "rejeitado",
          ativo: false,
          motivoAprovacao: workflowResumo.presidentReason || "",
          nivelAcessoVoluntario: null,
        };

  const resolutionActorId =
    workflowResumo.resolvedByPresident || workflowResumo.resolvedLevelByPresident
      ? String(workflowResumo?.president?.id || actorId || "")
      : String(actorId || "");

  const updated = await UsuarioService.atualizar(usuarioId, payload, {
    usuarioId: resolutionActorId || actorId,
  });

  return {
    usuario: updated,
    workflowResumo,
    finalized: true,
  };
}

function buildPageBase({ title, sectionTitle, navKey }) {
  return {
    title,
    sectionTitle,
    navKey,
    layout: "partials/app.ejs",
    pageClass: "page-acessos",
    extraCss: ["/css/acessos.css"],
    extraJs: [
      "/js/acessos-shared.js",
      "/js/acessos-user-modal.js",
      "/js/acessos-approval-modal.js",
      "/js/acessos.js",
    ],
  };
}

async function buildResumo(config = {}) {
  const base = config.showAllUsers
    ? {}
    : {
        tipoCadastro: config.tipoCadastro,
        perfil: PERFIS.USUARIO,
      };

  const [total, pendentes, aprovados, ativos] = await Promise.all([
    Usuario.countDocuments(base),
    Usuario.countDocuments({ ...base, statusAprovacao: "pendente" }),
    Usuario.countDocuments({
      ...base,
      $or: [{ statusAprovacao: "aprovado" }, { statusAprovacao: { $exists: false } }],
    }),
    Usuario.countDocuments({ ...base, ativo: true }),
  ]);

  return { total, pendentes, aprovados, ativos };
}

module.exports = {
  buildApprovalRoleOptions,
  buildApprovalWorkflowSummary,
  buildCreateProfileOptions,
  buildPageBase,
  buildRejectReasonCards,
  buildResumo,
  canManageTargetUser,
  canManageUsers,
  escapeRegex,
  isAdmin,
  isSuperAdminRequest,
  mapApprovalDetail,
  normalizeApprovalVotes,
  parseBoolean,
  parseLimit,
  parsePage,
  parseStatus,
  parseTipo,
  perfilLabel,
  resolveApprovalElectorate,
  resolveReturnTo,
  shouldUseVotingFlow,
  statusClass,
  statusLabel,
  summarizeApprovalVotes,
  tipoLabel,
  tryFinalizeApprovalDecision,
  upsertApprovalVote,
};
