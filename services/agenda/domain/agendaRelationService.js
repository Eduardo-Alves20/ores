const { Assistido } = require("../../../schemas/social/Assistido");
const {
  AgendaEvento,
  AGENDA_ROOM_REQUIRED_TYPES,
} = require("../../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../../schemas/social/AgendaSala");
const { listarHistoricoAgenda } = require("../../shared/agendaHistoryService");
const { asObjectId } = require("../../shared/agendaAvailabilityService");
const { isProvided } = require("./agendaDateValueService");
const { mapHistorico } = require("./agendaMappingService");

function isRoomRequiredForType(tipoAtendimento) {
  return AGENDA_ROOM_REQUIRED_TYPES.includes(String(tipoAtendimento || "").trim());
}

async function resolveRelations({ assistidoIdInput }) {
  const assistidoId = asObjectId(assistidoIdInput);

  let assistidoRef = null;
  if (assistidoId) {
    const assistido = await Assistido.findById(assistidoId).select("_id nome ativo");
    if (!assistido || !assistido.ativo) {
      return { error: "Assistido invalido ou inativo.", status: 400 };
    }
    assistidoRef = assistido;
  }

  return {
    assistidoId: assistidoId || null,
    assistidoRef,
  };
}

async function loadEventoById(eventoId) {
  return AgendaEvento.findById(eventoId)
    .populate("responsavelId", "_id nome perfil email telefone")
    .populate("assistidoId", "_id nome telefonePrincipal responsavel endereco")
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

  return { salaId, sala };
}

module.exports = {
  resolveRelations,
  loadEventoById,
  carregarEventoDetalhado,
  resolveSalaSelection,
};
