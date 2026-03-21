const Usuario = require("../../../schemas/core/Usuario");
const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../../schemas/social/AgendaSala");
const { PERFIS } = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../accessControlService");
const {
  buildAgendaInterval,
  buildAnySalaConflictFilter,
} = require("../../agendaAvailabilityService");
const { canManageRooms, canViewAll } = require("./agendaPermissionService");
const { createAgendaError } = require("./agendaErrorService");
const { parseBoolean, parseDateInput } = require("./agendaDateValueService");
const { mapSala } = require("./agendaMappingService");

function ensureAgendaViewAccess(user) {
  if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_VIEW])) {
    throw createAgendaError(403, "Acesso negado para agenda.");
  }
}

async function listAgendaProfessionals(user) {
  ensureAgendaViewAccess(user);

  if (!canViewAll(user)) {
    return {
      profissionais: [
        {
          _id: user.id,
          nome: user.nome,
          perfil: user.perfil,
        },
      ],
    };
  }

  const profissionais = await Usuario.find({
    ativo: true,
    perfil: { $in: [PERFIS.SUPERADMIN, PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO] },
  })
    .select("_id nome perfil")
    .sort({ nome: 1 })
    .lean();

  return { profissionais };
}

async function listAgendaRooms(user, query = {}) {
  ensureAgendaViewAccess(user);

  const incluirInativas = canManageRooms(user) && parseBoolean(query?.incluirInativas) === true;
  const filtro = {};
  if (!incluirInativas) filtro.ativo = true;

  const salas = await AgendaSala.find(filtro).sort({ nome: 1 }).lean();
  return { salas: salas.map(mapSala) };
}

async function listAvailableAgendaRooms(user, query = {}) {
  ensureAgendaViewAccess(user);

  const inicio = parseDateInput(query?.inicio);
  const fim = parseDateInput(query?.fim);
  if (!inicio) {
    throw createAgendaError(400, "Informe o inicio para consultar as salas.");
  }

  const intervalo = buildAgendaInterval({ inicio, fim });
  if (!intervalo.inicio || !intervalo.fim || intervalo.fim <= intervalo.inicio) {
    throw createAgendaError(400, "Intervalo de consulta invalido.");
  }

  const salas = await AgendaSala.find({ ativo: true }).sort({ nome: 1 }).lean();
  if (!salas.length) {
    return {
      inicio: intervalo.inicio,
      fim: intervalo.fim,
      salas: [],
    };
  }

  const filtroConflitos = buildAnySalaConflictFilter({
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    ignoreEventId: query?.eventoId || null,
  });

  const salasOcupadas = filtroConflitos ? await AgendaEvento.distinct("salaId", filtroConflitos) : [];
  const salaOcupadaSet = new Set((salasOcupadas || []).map((item) => String(item || "")));
  const disponiveis = salas.filter((sala) => !salaOcupadaSet.has(String(sala._id)));

  return {
    inicio: intervalo.inicio,
    fim: intervalo.fim,
    salas: disponiveis.map(mapSala),
  };
}

module.exports = {
  createAgendaError,
  listAgendaProfessionals,
  listAgendaRooms,
  listAvailableAgendaRooms,
};
