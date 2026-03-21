const Familia = require("../../../schemas/social/Familia");
const { Paciente } = require("../../../schemas/social/Paciente");
const {
  AgendaEvento,
  AGENDA_ROOM_REQUIRED_TYPES,
} = require("../../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../../schemas/social/AgendaSala");
const { listarHistoricoAgenda } = require("../../agendaHistoryService");
const {
  asObjectId,
  findSalaConflict,
} = require("../../agendaAvailabilityService");
const { isProvided } = require("./agendaDateValueService");
const { mapHistorico } = require("./agendaMappingService");

function isRoomRequiredForType(tipoAtendimento) {
  return AGENDA_ROOM_REQUIRED_TYPES.includes(String(tipoAtendimento || "").trim());
}

async function resolveRelations({ familiaIdInput, pacienteIdInput }) {
  const familiaId = asObjectId(familiaIdInput);
  const pacienteId = asObjectId(pacienteIdInput);

  let resolvedFamiliaId = familiaId;
  let resolvedPacienteId = pacienteId;
  let familiaRef = null;

  if (resolvedPacienteId) {
    const paciente = await Paciente.findById(resolvedPacienteId).select("_id familiaId ativo");
    if (!paciente || !paciente.ativo) {
      return { error: "Paciente invalido ou inativo.", status: 400 };
    }

    if (resolvedFamiliaId && String(paciente.familiaId) !== String(resolvedFamiliaId)) {
      return { error: "Paciente nao pertence a familia informada.", status: 400 };
    }

    resolvedFamiliaId = paciente.familiaId;
  }

  if (resolvedFamiliaId) {
    const familia = await Familia.findById(resolvedFamiliaId).select("_id ativo");
    if (!familia || !familia.ativo) {
      return { error: "Familia invalida ou inativa.", status: 400 };
    }
    familiaRef = familia;
  }

  return {
    familiaId: resolvedFamiliaId || null,
    pacienteId: resolvedPacienteId || null,
    familiaRef,
  };
}

async function loadEventoById(eventoId) {
  return AgendaEvento.findById(eventoId)
    .populate("responsavelId", "_id nome perfil email telefone")
    .populate("familiaId", "_id responsavel endereco")
    .populate("pacienteId", "_id nome")
    .populate("salaId", "_id nome descricao ativo")
    .populate("presencaRegistradaPor", "_id nome")
    .lean();
}

async function carregarEventoDetalhado(eventoId) {
  const [evento, historico] = await Promise.all([loadEventoById(eventoId), listarHistoricoAgenda(eventoId, 12)]);
  return {
    evento,
    historico: historico.map(mapHistorico),
  };
}

async function resolveSalaSelection({
  salaIdInput,
  tipoAtendimento,
  inicio,
  fim,
  ignoreEventId = null,
  allowEmptyRoom = false,
}) {
  const salaId = asObjectId(salaIdInput);
  if (isProvided(salaIdInput) && !salaId) {
    return { error: "Sala informada e invalida.", status: 400 };
  }

  if (!salaId) {
    if (isRoomRequiredForType(tipoAtendimento) && !allowEmptyRoom) {
      return { error: "Selecione uma sala de atendimento para este agendamento.", status: 400 };
    }
    return { salaId: null, sala: null };
  }

  const sala = await AgendaSala.findById(salaId).select("_id nome descricao ativo").lean();
  if (!sala || !sala.ativo) {
    return { error: "Sala informada esta inativa ou nao existe.", status: 400 };
  }

  const conflito = await findSalaConflict({
    salaId,
    inicio,
    fim,
    ignoreEventId,
  });

  if (conflito) {
    return {
      error: "A sala selecionada ja possui um agendamento neste horario.",
      status: 409,
      conflito,
    };
  }

  return { salaId, sala };
}

module.exports = {
  resolveRelations,
  loadEventoById,
  carregarEventoDetalhado,
  resolveSalaSelection,
};
