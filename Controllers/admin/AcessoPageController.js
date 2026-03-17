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
const { registrarAuditoria } = require("../../services/auditService");
const {
  hasAnyPermission,
  resolvePermissionsForUserId,
} = require("../../services/accessControlService");
const {
  listCustomFields,
  listQuickFilters,
} = require("../../services/systemConfigService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    extraJs: ["/js/acessos.js"],
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

class AcessoPageController {
  static async usuariosFamilia(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "familia",
      defaultLimit: 10,
      title: "Familias",
      sectionTitle: "Familias",
      navKey: "usuarios-familia",
      subtitle: "Familiares cadastrados para eventual acesso ao sistema.",
      basePath: "/acessos/familias",
    });
  }

  static async usuariosVoluntario(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "voluntario",
      showAllUsers: true,
      defaultLimit: 10,
      title: "Voluntarios",
      sectionTitle: "Voluntarios",
      navKey: "usuarios-voluntario",
      subtitle: "Todos os acessos do sistema, inclusive portal, equipe interna e administradores.",
      basePath: "/acessos/voluntarios",
    });
  }

  static async listarPorTipo(req, res, config) {
    try {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, config.defaultLimit || 20);
      const busca = String(req.query.busca || "").trim().slice(0, 100);
      const status = parseStatus(req.query.status, "todos");
      const ativo = parseBoolean(req.query.ativo);
      const perfilFiltro = String(req.query.perfil || "").trim().toLowerCase();

      const filtro = config.showAllUsers
        ? {}
        : {
            tipoCadastro: config.tipoCadastro,
            perfil: PERFIS.USUARIO,
          };

      if (busca) {
        const rx = new RegExp(escapeRegex(busca), "i");
        filtro.$or = [
          { nome: rx },
          { email: rx },
          { login: rx },
          { cpf: rx },
          { telefone: rx },
        ];
      }

      if (status === "pendente") {
        filtro.statusAprovacao = "pendente";
      } else if (status === "rejeitado") {
        filtro.statusAprovacao = "rejeitado";
      } else if (status === "aprovado") {
        filtro.$and = filtro.$and || [];
        filtro.$and.push({
          $or: [{ statusAprovacao: "aprovado" }, { statusAprovacao: { $exists: false } }],
        });
      }

      if (typeof ativo !== "undefined") {
        filtro.ativo = ativo;
      }

      if (perfilFiltro) {
        filtro.perfil = perfilFiltro;
      }

      const quickFilterArea = config.navKey === "usuarios-familia" ? "acessos_familias" : "acessos_voluntarios";
      const [resultado, resumo, customFields, quickFilters] = await Promise.all([
        Usuario.paginate(filtro, {
          page,
          limit,
          sort: { createdAt: -1 },
          select: "-senha",
          lean: true,
        }),
        buildResumo(config),
        listCustomFields("usuario", { includeInactive: false }),
        listQuickFilters(quickFilterArea, { includeInactive: false }),
      ]);

      const usuarios = (resultado.docs || []).map((doc) => ({
        statusAprovacaoNormalized: String(doc.statusAprovacao || "aprovado").toLowerCase(),
        ...doc,
        perfilLabel: perfilLabel(doc.perfil),
        papelAprovacaoLabel: getApprovalRoleLabel(doc.papelAprovacao),
        statusAprovacaoLabel: statusLabel(doc.statusAprovacao),
        statusAprovacaoClass: statusClass(doc.statusAprovacao),
        tipoCadastroLabel: tipoLabel(doc.tipoCadastro),
        nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(doc.nivelAcessoVoluntario),
        canEdit: canManageUsers(req) && canManageTargetUser(req, doc),
        canAdminister: isAdmin(req) && canManageTargetUser(req, doc),
      }));

      return res.status(200).render("pages/acessos/lista-tipo", {
        ...buildPageBase({
          title: config.title,
          sectionTitle: config.sectionTitle,
          navKey: config.navKey,
        }),
        subtitle: config.subtitle,
        basePath: config.basePath,
        tipoCadastro: config.tipoCadastro,
        tipoTabs: [
          {
            key: "usuarios-familia",
            label: "Familias",
            href: "/acessos/familias",
            isActive: config.navKey === "usuarios-familia",
          },
          {
            key: "usuarios-voluntario",
            label: "Voluntarios",
            href: "/acessos/voluntarios",
            isActive: config.navKey === "usuarios-voluntario",
          },
        ],
        resumo,
        quickFilters,
        usuarios,
        paginacao: {
          page: resultado.page || 1,
          totalPages: resultado.totalPages || 1,
          totalDocs: resultado.totalDocs || 0,
          hasPrevPage: !!resultado.hasPrevPage,
          hasNextPage: !!resultado.hasNextPage,
          prevPage: resultado.prevPage || 1,
          nextPage: resultado.nextPage || 1,
        },
        filtros: {
          busca,
          status,
          ativo: typeof ativo === "undefined" ? "" : String(ativo),
          limit,
          limitOptions: [10, 20, 50, 100],
        },
        isAdmin: isAdmin(req),
        canManageUsers: canManageUsers(req),
        createProfileOptions: buildCreateProfileOptions(req),
        volunteerAccessOptions: VOLUNTARIO_ACCESS_OPTIONS,
        customFields,
        approvalRoleOptions: buildApprovalRoleOptions(),
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      console.error("Erro ao carregar tela de usuarios por tipo:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar tela de usuarios.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async aprovacoes(req, res) {
    try {
      const actorId = req?.session?.user?.id || null;
      const electorate = await resolveApprovalElectorate();
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 10);
      const busca = String(req.query.busca || "").trim().slice(0, 100);
      const tipo = parseTipo(req.query.tipo, "todos");

      const filtro = {
        perfil: PERFIS.USUARIO,
        statusAprovacao: "pendente",
      };

      if (tipo !== "todos") {
        filtro.tipoCadastro = tipo;
      }

      if (busca) {
        const rx = new RegExp(escapeRegex(busca), "i");
        filtro.$or = [
          { nome: rx },
          { email: rx },
          { cpf: rx },
          { telefone: rx },
        ];
      }

      const [resultado, totalPendente] = await Promise.all([
        Usuario.paginate(filtro, {
          page,
          limit,
          sort: { createdAt: -1 },
          select: "-senha",
          lean: true,
        }),
        Usuario.countDocuments({ perfil: PERFIS.USUARIO, statusAprovacao: "pendente" }),
      ]);

      const usuarios = (resultado.docs || []).map((doc) => ({
        ...doc,
        tipoCadastroLabel: tipoLabel(doc.tipoCadastro),
        nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(doc.nivelAcessoVoluntario),
        votosResumo: summarizeApprovalVotes(doc.votosAprovacao, actorId, electorate.presidentId),
        workflowResumo: buildApprovalWorkflowSummary(doc, electorate),
      }));

      const totalVotos = usuarios.reduce(
        (acc, item) => acc + Number(item?.votosResumo?.total || 0),
        0
      );

      return res.status(200).render("pages/acessos/aprovacoes", {
        ...buildPageBase({
          title: "Aprovacoes",
          sectionTitle: "Aprovacoes",
          navKey: "aprovacoes",
        }),
        subtitle: "Fila de cadastro pendente para aprovacao do admin_alento.",
        usuarios,
        totalPendente,
        totalVotos,
        paginacao: {
          page: resultado.page || 1,
          totalPages: resultado.totalPages || 1,
          totalDocs: resultado.totalDocs || 0,
          hasPrevPage: !!resultado.hasPrevPage,
          hasNextPage: !!resultado.hasNextPage,
          prevPage: resultado.prevPage || 1,
          nextPage: resultado.nextPage || 1,
        },
        filtros: {
          busca,
          tipo,
          limit,
          limitOptions: [10, 20, 50, 100],
        },
        isAdmin: isAdmin(req),
        volunteerAccessOptions: VOLUNTARIO_ACCESS_OPTIONS,
        approvalRoleOptions: buildApprovalRoleOptions(),
        approvalElectorate: electorate,
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      console.error("Erro ao carregar tela de aprovacoes:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar aprovacoes.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async detalhe(req, res) {
    try {
      const { id } = req.params;
      const actorId = req?.session?.user?.id || null;
      const electorate = await resolveApprovalElectorate();
      const usuario = await UsuarioService.buscarPorId(id);

      if (!usuario) {
        return res.status(404).json({ erro: "Usuario nao encontrado." });
      }

      return res.status(200).json(await mapApprovalDetail(usuario, actorId, electorate));
    } catch (error) {
      console.error("Erro ao carregar detalhe de aprovacao:", error);
      return res.status(500).json({ erro: "Erro ao carregar a ficha de aprovacao." });
    }
  }

  static async aprovar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const usuarioAtual = await Usuario.findById(id)
        .select("_id nome perfil tipoCadastro statusAprovacao votosAprovacao nivelAcessoVoluntario")
        .lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (shouldUseVotingFlow(usuarioAtual)) {
        req.flash("error", "Esse cadastro deve ser decidido pela fila de votacao em Aprovações.");
        return res.redirect(returnTo);
      }

      const nivelAcessoVoluntario = usuarioAtual.tipoCadastro === "voluntario"
        ? normalizeVolunteerAccessLevel(
            req.body?.nivelAcessoVoluntario || usuarioAtual.nivelAcessoVoluntario,
            null
          )
        : null;

      if (usuarioAtual.tipoCadastro === "voluntario" && !nivelAcessoVoluntario) {
        req.flash("error", "Selecione o nivel de acesso do voluntario antes de aprovar.");
        return res.redirect(returnTo);
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

      const ativoBody = parseBoolean(req.body?.ativo);
      if (typeof ativoBody !== "undefined") {
        payload.ativo = ativoBody;
      } else if (usuarioAtual.tipoCadastro === "voluntario") {
        payload.ativo = true;
      }

      const usuario = await UsuarioService.atualizar(id, payload, { usuarioId: actorId });
      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_APROVADO",
        entidade: "usuario",
        entidadeId: id,
        detalhes: {
          tipoCadastro: usuario.tipoCadastro,
          ativo: usuario.ativo,
          nivelAcessoVoluntario: usuario.nivelAcessoVoluntario || "",
        },
      });

      req.flash(
        "success",
        usuario.tipoCadastro === "voluntario"
          ? `Cadastro aprovado com sucesso como ${getVolunteerAccessLabel(usuario.nivelAcessoVoluntario)}.`
          : "Cadastro aprovado com sucesso."
      );
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao aprovar usuario:", error);
      req.flash("error", error?.message || "Erro ao aprovar cadastro.");
      return res.redirect(returnTo);
    }
  }

  static async rejeitar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const motivo = String(req.body?.motivo || "").trim();
      const usuarioAtual = await Usuario.findById(id)
        .select("_id nome perfil statusAprovacao votosAprovacao")
        .lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (shouldUseVotingFlow(usuarioAtual)) {
        req.flash("error", "Esse cadastro deve ser decidido pela fila de votacao em Aprovações.");
        return res.redirect(returnTo);
      }

      const usuario = await UsuarioService.atualizar(
        id,
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
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_REJEITADO",
        entidade: "usuario",
        entidadeId: id,
        detalhes: {
          motivo: motivo || "",
        },
      });

      req.flash("success", "Cadastro rejeitado e acesso bloqueado.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao rejeitar usuario:", error);
      req.flash("error", error?.message || "Erro ao rejeitar cadastro.");
      return res.redirect(returnTo);
    }
  }

  static async alterarStatus(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        req.flash("error", "Campo ativo e obrigatorio.");
        return res.redirect(returnTo);
      }

      const usuarioAtual = await Usuario.findById(id).select("_id perfil").lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (!canManageTargetUser(req, usuarioAtual)) {
        req.flash("error", "Somente superadmin pode alterar status de outro superadmin.");
        return res.redirect(returnTo);
      }

      const usuario = await UsuarioService.alterarStatus(id, ativo, { usuarioId: actorId });
      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_INATIVADO",
        entidade: "usuario",
        entidadeId: id,
      });

      req.flash("success", ativo ? "Acesso ativado com sucesso." : "Acesso inativado com sucesso.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao alterar status de usuario:", error);
      req.flash("error", error?.message || "Erro ao alterar status do usuario.");
      return res.redirect(returnTo);
    }
  }

  static async votar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const decisao = String(req.body?.decisao || "").trim().toLowerCase();
      if (!["aprovar", "rejeitar"].includes(decisao)) {
        req.flash("error", "Vote em aprovar ou rejeitar.");
        return res.redirect(returnTo);
      }

      const motivo = String(req.body?.motivo || "").trim();
      const electorate = await resolveApprovalElectorate();

      const usuarioAtual = await Usuario.findById(id)
        .select("_id nome statusAprovacao votosAprovacao tipoCadastro nivelAcessoVoluntario")
        .lean();

      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (String(usuarioAtual.statusAprovacao || "").toLowerCase() !== "pendente") {
        req.flash("error", "Somente cadastros pendentes podem receber votos.");
        return res.redirect(returnTo);
      }

      const votosAtuais = normalizeApprovalVotes(usuarioAtual.votosAprovacao);
      const votoAtualDoAtor = votosAtuais.find((item) => String(item.adminId) === String(actorId || ""));

      const payload = {
        votosAprovacao: [],
      };

      if (decisao === "aprovar" && usuarioAtual.tipoCadastro === "voluntario") {
        const nivelAcessoVoluntario = normalizeVolunteerAccessLevel(
          req.body?.nivelAcessoVoluntario || votoAtualDoAtor?.nivelAcessoVoluntario,
          null
        );

        if (!nivelAcessoVoluntario) {
          req.flash("error", "Abra a ficha do voluntario e escolha o nivel de acesso antes de votar para aprovar.");
          return res.redirect(returnTo);
        }

        payload.votosAprovacao = upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, decisao, {
          motivo,
          nivelAcessoVoluntario,
        });
      } else {
        payload.votosAprovacao = upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, decisao, {
          motivo,
        });
      }

      const usuario = await UsuarioService.atualizar(
        id,
        payload,
        { usuarioId: actorId }
      );

      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      const finalizeResult = await tryFinalizeApprovalDecision(id, actorId, electorate);

      if (finalizeResult.finalized && finalizeResult.usuario) {
        await registrarAuditoria(req, {
          acao:
            finalizeResult.workflowResumo?.finalDecision === "aprovar"
              ? "USUARIO_APROVACAO_AUTOMATICA"
              : "USUARIO_REJEICAO_AUTOMATICA",
          entidade: "usuario",
          entidadeId: id,
          detalhes: {
            nivelAcessoVoluntario: finalizeResult.workflowResumo?.finalLevel || "",
            stateLabel: finalizeResult.workflowResumo?.stateLabel || "",
          },
        });

        req.flash(
          "success",
          finalizeResult.workflowResumo?.finalDecision === "aprovar"
            ? `Voto registrado e cadastro aprovado automaticamente${finalizeResult.workflowResumo?.finalLevel ? ` como ${getVolunteerAccessLabel(finalizeResult.workflowResumo.finalLevel)}` : ""}.`
            : "Voto registrado e cadastro rejeitado automaticamente."
        );
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: decisao === "aprovar" ? "USUARIO_VOTO_APROVACAO" : "USUARIO_VOTO_REJEICAO",
        entidade: "usuario",
        entidadeId: id,
        detalhes: {
          decisao,
          totalVotos: payload.votosAprovacao.length,
          motivo: motivo || "",
          nivelAcessoVoluntario:
            payload.votosAprovacao.find((item) => String(item.adminId) === String(actorId || ""))?.nivelAcessoVoluntario || "",
        },
      });

      const workflowResumo = buildApprovalWorkflowSummary(usuario, electorate);
      req.flash("success", `Voto registrado. ${workflowResumo.stateLabel}.`);
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao votar em cadastro:", error);
      req.flash("error", error?.message || "Erro ao registrar voto.");
      return res.redirect(returnTo);
    }
  }
}

module.exports = AcessoPageController;


