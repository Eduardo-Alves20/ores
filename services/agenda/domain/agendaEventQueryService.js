const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const Usuario = require("../../../schemas/core/Usuario");
const { PERFIS } = require("../../../config/roles");
const { VOLUNTARIO_ACCESS_LEVELS } = require("../../../config/volunteerAccess");
const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");
const { asObjectId } = require("../../shared/agendaAvailabilityService");
const {
  canMutateEvent,
  canViewAll,
} = require("./agendaPermissionService");
const { createAgendaError, ensureAgendaObjectId } = require("./agendaErrorService");
const {
  getMonthRange,
  parseBoolean,
} = require("./agendaDateValueService");
const {
  carregarEventoDetalhado,
  loadEventoById,
} = require("./agendaRelationService");
const { mapEvento } = require("./agendaMappingService");

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

async function resolveAtendimentoProfessionalIdsForViewer(user) {
  if (!isSocialAssistantViewer(user)) return null;

  const ids = await Usuario.find(buildAtendimentoProfessionalFilter())
    .distinct("_id");

  const normalizedIds = Array.isArray(ids)
    ? ids.map((item) => asObjectId(item)).filter(Boolean)
    : [];

  const ownId = asObjectId(user?.id);
  if (ownId && !normalizedIds.some((item) => String(item) === String(ownId))) {
    normalizedIds.push(ownId);
  }

  return normalizedIds;
}

async function listAgendaEvents(user, query = {}) {
  ensureAgendaViewAccess(user);

  const { inicio, fim } = getMonthRange(query);
  if (!inicio || !fim || inicio >= fim) {
    throw createAgendaError(400, "Intervalo de datas invalido.");
  }

  const diffDays = Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 93) {
    throw createAgendaError(400, "Intervalo maximo permitido: 93 dias.");
  }

  const filtro = {
    inicio: {
      $gte: inicio,
      $lt: fim,
    },
  };

  const incluirInativos = parseBoolean(query?.incluirInativos) === true;
  if (!incluirInativos) filtro.ativo = true;

  if (canViewAll(user)) {
    const atendimentoProfessionalIds = await resolveAtendimentoProfessionalIdsForViewer(user);
    const responsavelIdInput = String(query?.responsavelId || "").trim();

    if (responsavelIdInput) {
      const requestedId = asObjectId(
        ensureAgendaObjectId(responsavelIdInput, "Responsavel informado e invalido.")
      );

      if (Array.isArray(atendimentoProfessionalIds)) {
        const isAllowed = atendimentoProfessionalIds.some(
          (item) => String(item || "") === String(requestedId || "")
        );
        filtro.responsavelId = isAllowed ? requestedId : { $in: [] };
      } else {
        filtro.responsavelId = requestedId;
      }
    } else if (Array.isArray(atendimentoProfessionalIds)) {
      filtro.responsavelId = { $in: atendimentoProfessionalIds };
    }
  } else {
    filtro.responsavelId = asObjectId(user.id);
  }

  const eventos = await AgendaEvento.find(filtro)
    .sort({ inicio: 1, createdAt: 1 })
    .populate("responsavelId", "_id nome perfil email telefone")
    .populate("familiaId", "_id responsavel endereco")
    .populate("pacienteId", "_id nome")
    .populate("salaId", "_id nome descricao ativo")
    .populate("presencaRegistradaPor", "_id nome")
    .lean();

  return {
    inicio,
    fim,
    eventos: eventos.map(mapEvento),
  };
}

async function getAgendaEventDetail(user, eventId) {
  ensureAgendaViewAccess(user);

  const normalizedEventId = ensureAgendaObjectId(eventId, "Identificador de agendamento invalido.");
  const evento = await AgendaEvento.findById(normalizedEventId);
  if (!evento) {
    throw createAgendaError(404, "Evento de agenda nao encontrado.");
  }

  if (!canMutateEvent(user, evento)) {
    throw createAgendaError(403, "Sem permissao para visualizar este evento.");
  }

  const detalhe = await carregarEventoDetalhado(evento._id);

  return {
    evento: mapEvento(detalhe.evento),
    historico: detalhe.historico,
  };
}

module.exports = {
  listAgendaEvents,
  getAgendaEventDetail,
};
