const Usuario = require("../../../schemas/core/Usuario");
const { PERFIS } = require("../../../config/roles");
const {
  VOLUNTARIO_ACCESS_OPTIONS,
  getVolunteerAccessLabel,
} = require("../../../config/volunteerAccess");
const { getApprovalRoleLabel } = require("../../../config/approvalRoles");
const {
  listCustomFields,
  listQuickFilters,
} = require("../../shared/systemConfigService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { escapeRegex } = require("../../shared/searchUtilsService");
const {
  parseLimit,
  parsePage,
  parseStatus,
  parseTipo,
} = require("./accessFilterService");
const {
  buildApprovalRoleOptions,
  buildCreateProfileOptions,
  canReviewSensitiveApprovalData,
  canManageTargetUser,
  canManageUsers,
  isAdmin,
} = require("./accessPermissionService");
const {
  buildApprovalWorkflowSummary,
  resolveApprovalElectorate,
  summarizeApprovalVotes,
} = require("./accessApprovalWorkflowService");
const {
  buildPageBase,
  buildResumo,
  perfilLabel,
  statusClass,
  statusLabel,
  tipoLabel,
} = require("./accessPresentationService");

const LIMIT_OPTIONS = Object.freeze([10, 20, 50, 100]);
const USER_TYPE_TABS = Object.freeze([
  {
    key: "usuarios-familia",
    label: "Familias",
    href: "/acessos/familias",
  },
  {
    key: "usuarios-voluntario",
    label: "Voluntarios",
    href: "/acessos/voluntarios",
  },
]);

function buildPagination(resultado = {}) {
  return {
    page: resultado.page || 1,
    totalPages: resultado.totalPages || 1,
    totalDocs: resultado.totalDocs || 0,
    hasPrevPage: !!resultado.hasPrevPage,
    hasNextPage: !!resultado.hasNextPage,
    prevPage: resultado.prevPage || 1,
    nextPage: resultado.nextPage || 1,
  };
}

function buildTipoTabs(activeKey) {
  return USER_TYPE_TABS.map((tab) => ({
    ...tab,
    isActive: tab.key === activeKey,
  }));
}

function buildUserTypeFilter(config, { busca, status, ativo, perfilFiltro }) {
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

  return filtro;
}

async function buildUserTypePageView(req, config) {
  const page = parsePage(req.query.page, 1);
  const limit = parseLimit(req.query.limit, config.defaultLimit || 20);
  const busca = String(req.query.busca || "").trim().slice(0, 100);
  const status = parseStatus(req.query.status, "todos");
  const ativo = parseBoolean(req.query.ativo);
  const perfilFiltro = String(req.query.perfil || "").trim().toLowerCase();
  const filtro = buildUserTypeFilter(config, { busca, status, ativo, perfilFiltro });
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

  return {
    ...buildPageBase({
      title: config.title,
      sectionTitle: config.sectionTitle,
      navKey: config.navKey,
    }),
    subtitle: config.subtitle,
    basePath: config.basePath,
    tipoCadastro: config.tipoCadastro,
    tipoTabs: buildTipoTabs(config.navKey),
    resumo,
    quickFilters,
    usuarios,
    paginacao: buildPagination(resultado),
    filtros: {
      busca,
      status,
      ativo: typeof ativo === "undefined" ? "" : String(ativo),
      limit,
      limitOptions: LIMIT_OPTIONS,
    },
    isAdmin: isAdmin(req),
    canReviewSensitiveApprovalData: canReviewSensitiveApprovalData(req),
    canManageUsers: canManageUsers(req),
    createProfileOptions: buildCreateProfileOptions(req),
    volunteerAccessOptions: VOLUNTARIO_ACCESS_OPTIONS,
    customFields,
    approvalRoleOptions: buildApprovalRoleOptions(),
  };
}

function buildApprovalQueueFilter({ busca, tipo }) {
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

  return filtro;
}

async function buildApprovalQueuePageView(req) {
  const actorId = req?.session?.user?.id || null;
  const electorate = await resolveApprovalElectorate();
  const page = parsePage(req.query.page, 1);
  const limit = parseLimit(req.query.limit, 10);
  const busca = String(req.query.busca || "").trim().slice(0, 100);
  const tipo = parseTipo(req.query.tipo, "todos");
  const filtro = buildApprovalQueueFilter({ busca, tipo });

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

  return {
    ...buildPageBase({
      title: "Aprovacoes",
      sectionTitle: "Aprovacoes",
      navKey: "aprovacoes",
    }),
    subtitle: "Fila de cadastro pendente com conferencia restrita para administracao e assistencia social autorizada.",
    usuarios,
    totalPendente,
    totalVotos,
    paginacao: buildPagination(resultado),
    filtros: {
      busca,
      tipo,
      limit,
      limitOptions: LIMIT_OPTIONS,
    },
    isAdmin: isAdmin(req),
    canReviewSensitiveApprovalData: canReviewSensitiveApprovalData(req),
    volunteerAccessOptions: VOLUNTARIO_ACCESS_OPTIONS,
    approvalRoleOptions: buildApprovalRoleOptions(),
    approvalElectorate: electorate,
  };
}

module.exports = {
  buildUserTypePageView,
  buildApprovalQueuePageView,
};
