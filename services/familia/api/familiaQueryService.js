const Familia = require("../../../schemas/social/Familia");
const { Paciente } = require("../../../schemas/social/Paciente");
const { Atendimento } = require("../../../schemas/social/Atendimento");
const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const Usuario = require("../../../schemas/core/Usuario");
const { PERFIS } = require("../../../config/roles");
const { parseBoolean } = require("../../shared/valueParsingService");
const { escapeRegex } = require("../../shared/searchUtilsService");
const {
  hasOwnAssistidosScope,
  resolveScopedFamilyIds,
  canAccessFamily,
} = require("../../volunteerScopeService");
const { createFamiliaError } = require("./familiaContextService");
const { mapAgendaPresenca } = require("./familiaPresentationService");

const ALLOWED_SORT_FIELDS = new Set(["updatedAt", "createdAt", "responsavel.nome"]);

function parseFamilyListQuery(query = {}) {
  return {
    page: Math.max(Number(query.page) || 1, 1),
    limit: Math.min(Math.max(Number(query.limit) || 10, 1), 100),
    busca: String(query.busca || "").trim().slice(0, 100),
    ativo: parseBoolean(query.ativo),
    parentesco: String(query.parentesco || "").trim().slice(0, 60),
    cidade: String(query.cidade || "").trim().slice(0, 80),
    sortBy: String(query.sortBy || "updatedAt"),
    sortDir: String(query.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1,
  };
}

function buildFamilyListFilter(filters = {}) {
  const filtro = {};

  if (typeof filters.ativo !== "undefined") filtro.ativo = filters.ativo;
  if (filters.parentesco) {
    filtro["responsavel.parentesco"] = new RegExp(`^${escapeRegex(filters.parentesco)}$`, "i");
  }
  if (filters.cidade) {
    filtro["endereco.cidade"] = new RegExp(escapeRegex(filters.cidade), "i");
  }

  if (filters.busca) {
    const rx = new RegExp(escapeRegex(filters.busca), "i");
    filtro.$or = [
      { "responsavel.nome": rx },
      { "responsavel.telefone": rx },
      { "responsavel.email": rx },
      { "endereco.cidade": rx },
      { "responsavel.parentesco": rx },
    ];
  }

  return filtro;
}

function buildFamilySort(filters = {}) {
  const sortField = ALLOWED_SORT_FIELDS.has(filters.sortBy) ? filters.sortBy : "updatedAt";
  return { [sortField]: filters.sortDir };
}

async function applyFamilyScopeFilter(filtro, user) {
  const scopedFamilyIds = await resolveScopedFamilyIds(user);
  if (Array.isArray(scopedFamilyIds)) {
    filtro._id = { $in: scopedFamilyIds };
  }
  return filtro;
}

async function enrichFamiliesWithPatientCounts(resultado = {}) {
  const ids = (resultado.docs || []).map((doc) => doc._id);
  const countByFamilia = await Paciente.aggregate([
    { $match: { familiaId: { $in: ids }, ativo: true } },
    { $group: { _id: "$familiaId", total: { $sum: 1 } } },
  ]);

  const mapCount = new Map(countByFamilia.map((item) => [String(item._id), item.total]));

  return {
    ...resultado,
    docs: (resultado.docs || []).map((doc) => ({
      ...doc,
      pacientesAtivos: mapCount.get(String(doc._id)) || 0,
    })),
  };
}

async function listFamilies({ user, query = {} }) {
  const filters = parseFamilyListQuery(query);
  const filtro = await applyFamilyScopeFilter(buildFamilyListFilter(filters), user);

  const result = await Familia.paginate(filtro, {
    page: filters.page,
    limit: filters.limit,
    sort: buildFamilySort(filters),
    lean: true,
  });

  return enrichFamiliesWithPatientCounts(result);
}

function buildFamilyRecordsFilter(id, incluirInativos) {
  return {
    familiaId: id,
    ...(incluirInativos ? {} : { ativo: true }),
  };
}

async function loadFamilyVolunteers(user, actorId) {
  if (hasOwnAssistidosScope(user)) {
    return Usuario.find({
      _id: actorId,
      ativo: true,
    })
      .select("_id nome login email")
      .lean();
  }

  return Usuario.find({
    tipoCadastro: "voluntario",
    perfil: PERFIS.USUARIO,
    statusAprovacao: "aprovado",
    ativo: true,
  })
    .sort({ nome: 1 })
    .select("_id nome login email")
    .lean();
}

async function loadFamilyDetail({ id, user, actorId, query = {} }) {
  const incluirInativos = parseBoolean(query.incluirInativos) === true;

  if (!(await canAccessFamily(user, id))) {
    throw createFamiliaError(
      "Acesso restrito a familias vinculadas ao proprio atendimento.",
      403
    );
  }

  const familia = await Familia.findById(id).lean();
  if (!familia) {
    return null;
  }

  const filtroBase = buildFamilyRecordsFilter(id, incluirInativos);

  const [pacientes, atendimentos, voluntarios, presencasAgenda] = await Promise.all([
    Paciente.find(filtroBase).sort({ nome: 1 }).lean(),
    Atendimento.find(filtroBase)
      .sort({ dataHora: -1 })
      .limit(200)
      .populate({
        path: "profissionalId",
        select: "nome login email",
      })
      .lean(),
    loadFamilyVolunteers(user, actorId),
    AgendaEvento.find(filtroBase)
      .sort({ inicio: -1 })
      .limit(200)
      .populate("responsavelId", "_id nome")
      .populate("pacienteId", "_id nome")
      .populate("salaId", "_id nome")
      .populate("presencaRegistradaPor", "_id nome")
      .lean(),
  ]);

  return {
    familia,
    pacientes,
    atendimentos,
    voluntarios,
    presencasAgenda: (presencasAgenda || []).map(mapAgendaPresenca),
  };
}

module.exports = {
  applyFamilyScopeFilter,
  buildFamilyListFilter,
  buildFamilySort,
  buildFamilyRecordsFilter,
  enrichFamiliesWithPatientCounts,
  listFamilies,
  loadFamilyDetail,
  loadFamilyVolunteers,
  parseFamilyListQuery,
};
