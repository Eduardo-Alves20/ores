const Usuario = require("../../../schemas/core/Usuario");
const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../../schemas/social/AgendaSala");
const { PERFIS } = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const { VOLUNTARIO_ACCESS_LEVELS } = require("../../../config/volunteerAccess");
const { hasAnyPermission } = require("../../shared/accessControlService");
const {
  buildAgendaInterval,
  buildAnySalaConflictFilter,
} = require("../../shared/agendaAvailabilityService");
const { canManageRooms, canViewAll } = require("./agendaPermissionService");
const { createAgendaError, ensureAgendaObjectId } = require("./agendaErrorService");
const { parseBoolean, parseDateInput } = require("./agendaDateValueService");
const { mapSala } = require("./agendaMappingService");

function ensureAgendaViewAccess(user) {
  if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_VIEW])) {
    throw createAgendaError(403, "Acesso negado para agenda.");
  }
}

function isSocialAssistantViewer(user) {
  const perfil = String(user?.perfil || "").trim().toLowerCase();
  const nivel = String(user?.nivelAcessoVoluntario || "").trim().toLowerCase();
  return perfil === PERFIS.USUARIO && nivel === VOLUNTARIO_ACCESS_LEVELS.SERVICO_SOCIAL;
}

function buildAtendimentoProfessionalFilter() {
  return {
    ativo: true,
    perfil: PERFIS.USUARIO,
    tipoCadastro: "voluntario",
    statusAprovacao: "aprovado",
    nivelAcessoVoluntario: VOLUNTARIO_ACCESS_LEVELS.VOLUNTARIO_ATENDIMENTO,
  };
}

async function listAgendaProfessionals(user) {
  ensureAgendaViewAccess(user);
  const socialAssistantViewer = isSocialAssistantViewer(user);

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

  const filter = socialAssistantViewer
    ? buildAtendimentoProfessionalFilter()
    : {
        ativo: true,
        perfil: { $in: [PERFIS.SUPERADMIN, PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO] },
      };

  const profissionais = await Usuario.find(filter)
    .select("_id nome perfil")
    .sort({ nome: 1 })
    .lean();

  if (socialAssistantViewer) {
    const ownId = String(user?.id || "").trim();
    if (ownId && !profissionais.some((item) => String(item?._id || "") === ownId)) {
      profissionais.push({
        _id: ownId,
        nome: String(user?.nome || "Minha agenda").trim() || "Minha agenda",
        perfil: String(user?.perfil || "").trim().toLowerCase(),
      });
      profissionais.sort((left, right) =>
        String(left?.nome || "").localeCompare(String(right?.nome || ""), "pt-BR")
      );
    }
  }

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

  const eventoIdInput = String(query?.eventoId || "").trim();
  const normalizedEventId = eventoIdInput
    ? ensureAgendaObjectId(eventoIdInput, "Identificador de agendamento invalido.")
    : null;

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
    ignoreEventId: normalizedEventId,
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
