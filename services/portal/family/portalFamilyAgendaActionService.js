const { AgendaEvento } = require("../../../schemas/social/AgendaEvento");
const { asObjectId } = require("../../agendaAvailabilityService");
const {
  createAgendaError,
  ensureAgendaObjectId,
} = require("../../agenda/domain/agendaErrorService");
const {
  getStatusAgendamentoForPresence,
  PRESENCA_LABELS,
} = require("../../agenda/domain/agendaMappingService");
const { registrarHistoricoAgenda } = require("../../agendaHistoryService");
const { notify, resolveAdminRecipients } = require("../../notificationService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { resolvePresenceReasonByKey } = require("../../systemConfigService");
const { mapPortalFamilyAgendaEvent } = require("./portalFamilyFormattingService");

function buildFamilyActor(context = {}) {
  const usuario = context?.usuario || {};
  const familia = context?.familia || {};

  return {
    id: context?.userId || usuario?._id || null,
    _id: context?.userId || usuario?._id || null,
    nome:
      String(usuario?.nome || "").trim() ||
      String(familia?.responsavel?.nome || "").trim() ||
      "Familia",
    perfil: String(usuario?.perfil || "usuario").trim() || "usuario",
  };
}

async function loadFamilyEventOrFail(familiaId, eventId) {
  if (!familiaId) {
    throw createAgendaError(403, "Familia nao vinculada para este acesso.");
  }

  const normalizedEventId = ensureAgendaObjectId(
    eventId,
    "Identificador de agendamento invalido."
  );
  const evento = await AgendaEvento.findOne({
    _id: normalizedEventId,
    familiaId,
  })
    .populate("responsavelId", "_id nome email telefone perfil")
    .populate("pacienteId", "_id nome")
    .populate("salaId", "_id nome descricao")
    .lean();

  if (!evento) {
    throw createAgendaError(404, "Agendamento nao encontrado para esta familia.");
  }

  if (evento.ativo === false) {
    throw createAgendaError(400, "Nao e possivel agir sobre um agendamento inativo.");
  }

  if (String(evento.statusAgendamento || "") === "cancelado") {
    throw createAgendaError(400, "Nao e possivel alterar um agendamento cancelado.");
  }

  return evento;
}

async function reloadFamilyEvent(eventId) {
  const evento = await AgendaEvento.findById(eventId)
    .populate("responsavelId", "_id nome email telefone perfil")
    .populate("pacienteId", "_id nome")
    .populate("salaId", "_id nome descricao")
    .lean();

  return evento || null;
}

async function registerFamilyAbsence(context = {}, eventId, body = {}) {
  const familiaId = context?.familia?._id || null;
  const evento = await loadFamilyEventOrFail(familiaId, eventId);

  const inicio = new Date(evento?.inicio);
  if (!Number.isNaN(inicio.getTime()) && inicio > new Date()) {
    throw createAgendaError(
      400,
      "Essa consulta ainda nao ocorreu. Para alterar a data, use a opcao de remarcacao."
    );
  }

  const observacao = String(body?.observacao || "").trim().slice(0, 1000);
  const justificativaKey = String(body?.justificativaKey || "").trim();
  const statusPresenca = justificativaKey ? "falta_justificada" : "falta";
  const justificativa = justificativaKey
    ? await resolvePresenceReasonByKey(justificativaKey, statusPresenca)
    : null;

  if (justificativaKey && !justificativa) {
    throw createAgendaError(400, "Justificativa de falta invalida.");
  }

  const actorId = asObjectId(context?.userId || context?.usuario?._id);
  const statusAgendamento = getStatusAgendamentoForPresence(
    evento.statusAgendamento,
    statusPresenca
  );

  await AgendaEvento.findByIdAndUpdate(
    evento._id,
    {
      statusPresenca,
      statusAgendamento,
      presencaObservacao: observacao,
      presencaJustificativaKey: justificativa ? justificativaKey : "",
      presencaJustificativaLabel: justificativa?.nome || "",
      presencaRegistradaEm: new Date(),
      presencaRegistradaPor: actorId,
      atualizadoPor: actorId,
    },
    { new: true, runValidators: true }
  );

  await registrarHistoricoAgenda({
    eventoId: evento._id,
    tipo: "presenca_registrada_familia",
    visibilidade: "todos",
    titulo: "Falta registrada pela familia",
    descricao: `A familia registrou ${PRESENCA_LABELS[statusPresenca] || "falta"} para o agendamento "${evento?.titulo || "Consulta"}".`,
    detalhes: {
      statusPresenca,
      statusAgendamento,
      justificativa: justificativa?.nome || "",
      observacao,
    },
    ator: buildFamilyActor(context),
  });

  const updated = await reloadFamilyEvent(evento._id);

  return {
    mensagem: "Falta registrada com sucesso.",
    evento: mapPortalFamilyAgendaEvent(updated || evento),
  };
}

async function requestFamilyReschedule(context = {}, eventId, body = {}) {
  const familiaId = context?.familia?._id || null;
  const evento = await loadFamilyEventOrFail(familiaId, eventId);

  if (String(evento.statusAgendamento || "") === "em_negociacao_remarcacao") {
    throw createAgendaError(400, "Uma solicitacao de remarcacao ja foi enviada.");
  }

  const inicio = new Date(evento?.inicio);
  if (!Number.isNaN(inicio.getTime()) && inicio < new Date()) {
    throw createAgendaError(400, "Essa consulta ja ocorreu. Converse com a equipe.");
  }

  const motivo = String(body?.motivo || "").trim().slice(0, 1000);
  if (!motivo || motivo.length < 3) {
    throw createAgendaError(400, "Informe o motivo da remarcacao.");
  }

  const actorId = asObjectId(context?.userId || context?.usuario?._id);

  await AgendaEvento.findByIdAndUpdate(
    evento._id,
    {
      statusAgendamento: "em_negociacao_remarcacao",
      atualizadoPor: actorId,
    },
    { new: true, runValidators: true }
  );

  await registrarHistoricoAgenda({
    eventoId: evento._id,
    tipo: "remarcacao_solicitada_familia",
    visibilidade: "todos",
    titulo: "Remarcacao solicitada pela familia",
    descricao: `A familia solicitou remarcacao para "${evento?.titulo || "Consulta"}".`,
    detalhes: {
      motivo,
    },
    ator: buildFamilyActor(context),
  });

  const recipients = [];
  if (evento?.responsavelId?._id) {
    recipients.push({
      usuarioId: evento.responsavelId._id,
      nome: evento.responsavelId.nome,
      email: evento.responsavelId.email,
      telefone: evento.responsavelId.telefone,
      channels: ["sistema", "email", "whatsapp"],
    });
  }

  const admins = await resolveAdminRecipients();
  admins.forEach((admin) => {
    recipients.push({
      ...admin,
      channels: ["sistema", "email", "whatsapp"],
    });
  });

  const familiaNome =
    String(context?.familia?.responsavel?.nome || "").trim() ||
    "Familia";
  const inicioLabel = toDateTimeLabel(evento?.inicio);

  await notify({
    categoria: "agenda",
    evento: "agenda.remarcacao_solicitada",
    titulo: "Remarcacao solicitada pela familia",
    mensagem: `A familia ${familiaNome} solicitou remarcacao da consulta "${evento?.titulo || "Consulta"}" marcada para ${inicioLabel}.`,
    recipients,
    referenciaTipo: "agenda_evento",
    referenciaId: evento?._id,
    payload: {
      meta: {
        kind: "family_reschedule_request",
        tituloEvento: evento?.titulo || "Consulta",
        inicioLabel,
        responsavelNome: evento?.responsavelId?.nome || "",
        familiaNome,
        motivo,
      },
    },
  });

  const updated = await reloadFamilyEvent(evento._id);

  return {
    mensagem: "Solicitacao de remarcacao enviada.",
    evento: mapPortalFamilyAgendaEvent(updated || evento),
  };
}

module.exports = {
  registerFamilyAbsence,
  requestFamilyReschedule,
};
