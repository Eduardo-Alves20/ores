const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const {
  AgendaEvento,
  AGENDA_ROOM_REQUIRED_TYPES,
} = require("../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../schemas/social/AgendaSala");
const { PERMISSIONS } = require("../../config/permissions");
const { listarHistoricoAgenda } = require("../agendaHistoryService");
const { hasAnyPermission } = require("../accessControlService");
const { notify, resolveAdminRecipients } = require("../notificationService");
const {
  asObjectId,
  findSalaConflict,
  getEffectiveEnd,
  parseAgendaDate,
} = require("../agendaAvailabilityService");
const { parseBoolean } = require("../shared/valueParsingService");
const { toDateTimeLabel } = require("../shared/dateFormattingService");

const PRESENCA_LABELS = Object.freeze({
  pendente: "Pendente",
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  cancelado_antecipadamente: "Cancelado antecipadamente",
});

const AGENDAMENTO_LABELS = Object.freeze({
  agendado: "Agendado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  em_analise_cancelamento: "Em analise de cancelamento",
  em_negociacao_remarcacao: "Em negociacao de remarcacao",
  remarcado: "Remarcado",
});

function getSessionUser(req) {
  return req?.session?.user || null;
}

function canViewAll(user) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_VIEW_ALL]);
}

function canAssignOthers(user) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_ASSIGN_OTHERS]);
}

function canManageRooms(user) {
  return canViewAll(user);
}

function canMutateEvent(user, evento) {
  if (canViewAll(user)) return true;
  return String(evento?.responsavelId || "") === String(user?.id || "");
}

function canRegisterAttendance(user, evento) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_ATTENDANCE]) && canMutateEvent(user, evento);
}

function parseDateInput(value) {
  return parseAgendaDate(value);
}

function getMonthRange(query) {
  const inicioQuery = parseDateInput(query?.inicio);
  const fimQuery = parseDateInput(query?.fim);

  if (inicioQuery && fimQuery) {
    return { inicio: inicioQuery, fim: fimQuery };
  }

  const ref = parseDateInput(query?.referencia) || new Date();
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0);
  return { inicio, fim };
}

function toDayDateString(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function toTimeString(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(11, 16);
}

function getStatusAgendamentoForPresence(currentStatusAgendamento, statusPresenca) {
  if (statusPresenca === "cancelado_antecipadamente") return "cancelado";
  if (statusPresenca === "presente" || statusPresenca === "falta" || statusPresenca === "falta_justificada") {
    return "encerrado";
  }
  if (currentStatusAgendamento === "remarcado") return "remarcado";
  return "agendado";
}

function mapHistorico(doc) {
  return {
    _id: doc?._id,
    tipo: doc?.tipo || "",
    titulo: doc?.titulo || "",
    descricao: doc?.descricao || "",
    visibilidade: doc?.visibilidade || "interna",
    atorNome: doc?.atorNome || "",
    atorPerfil: doc?.atorPerfil || "",
    createdAt: doc?.createdAt || null,
    createdAtLabel: doc?.createdAt ? toDateTimeLabel(doc.createdAt) : "-",
  };
}

function sanitizeTitle(value) {
  return String(value || "").trim().slice(0, 140);
}

function sanitizeSalaNome(value) {
  return String(value || "").trim().slice(0, 120);
}

function sanitizeSalaDescricao(value) {
  return String(value || "").trim().slice(0, 240);
}

function isProvided(value) {
  return typeof value !== "undefined" && value !== null && String(value).trim() !== "";
}

function isRoomRequiredForType(tipoAtendimento) {
  return AGENDA_ROOM_REQUIRED_TYPES.includes(String(tipoAtendimento || "").trim());
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
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

function mapSala(doc) {
  const sala = doc?.toObject ? doc.toObject() : doc;
  if (!sala) return null;

  return {
    _id: sala._id,
    nome: sala.nome || "",
    descricao: sala.descricao || "",
    ativo: sala.ativo !== false,
  };
}

function mapEvento(doc) {
  const evento = doc?.toObject ? doc.toObject() : doc;
  const inicio = evento?.inicio ? new Date(evento.inicio) : null;
  const fim = getEffectiveEnd(evento?.inicio, evento?.fim);

  return {
    _id: evento?._id,
    titulo: evento?.titulo || "",
    tipoAtendimento: evento?.tipoAtendimento || "outro",
    inicio: evento?.inicio,
    fim: fim || null,
    local: evento?.local || "",
    observacoes: evento?.observacoes || "",
    statusAgendamento: evento?.statusAgendamento || "agendado",
    statusAgendamentoLabel:
      AGENDAMENTO_LABELS[evento?.statusAgendamento || "agendado"] || "Agendado",
    statusPresenca: evento?.statusPresenca || "pendente",
    statusPresencaLabel:
      PRESENCA_LABELS[evento?.statusPresenca || "pendente"] || "Pendente",
    presencaObservacao: evento?.presencaObservacao || "",
    presencaJustificativaKey: evento?.presencaJustificativaKey || "",
    presencaJustificativaLabel: evento?.presencaJustificativaLabel || "",
    ativo: !!evento?.ativo,
    dia: inicio ? toDayDateString(inicio) : "",
    hora: inicio ? toTimeString(inicio) : "",
    sala: mapSala(evento?.salaId),
    familia: evento?.familiaId
      ? {
          _id: evento.familiaId._id || evento.familiaId,
          responsavelNome: evento.familiaId?.responsavel?.nome || "",
          cidade: evento.familiaId?.endereco?.cidade || "",
        }
      : null,
    paciente: evento?.pacienteId
      ? {
          _id: evento.pacienteId._id || evento.pacienteId,
          nome: evento.pacienteId?.nome || "",
        }
      : null,
    presencaRegistradaPor: evento?.presencaRegistradaPor
      ? {
          _id: evento.presencaRegistradaPor._id || evento.presencaRegistradaPor,
          nome: evento.presencaRegistradaPor?.nome || "",
        }
      : null,
    presencaRegistradaEm: evento?.presencaRegistradaEm || null,
    presencaRegistradaEmLabel: evento?.presencaRegistradaEm
      ? toDateTimeLabel(evento.presencaRegistradaEm)
      : "-",
    responsavel: evento?.responsavelId
      ? {
          _id: evento.responsavelId._id || evento.responsavelId,
          nome: evento.responsavelId?.nome || "",
          perfil: evento.responsavelId?.perfil || "",
          email: evento.responsavelId?.email || "",
          telefone: evento.responsavelId?.telefone || "",
        }
      : null,
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

async function dispatchPresenceNotifications(evento) {
  if (!evento) return [];

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

  const familiaResponsavel = evento?.familiaId?.responsavel || null;
  if (familiaResponsavel?.email || familiaResponsavel?.telefone) {
    recipients.push({
      nome: familiaResponsavel?.nome || "Familia",
      email: familiaResponsavel?.email || "",
      telefone: familiaResponsavel?.telefone || "",
      channels: ["email", "whatsapp"],
    });
  }

  const meta = {
    statusPresenca: PRESENCA_LABELS[evento?.statusPresenca || "pendente"] || "Atualizado",
    tituloEvento: evento?.titulo || "Agendamento",
    inicioLabel: toDateTimeLabel(evento?.inicio),
    responsavelNome: evento?.responsavelId?.nome || "",
    justificativa: evento?.presencaJustificativaLabel || "",
  };

  return notify({
    categoria: "agenda",
    evento: "agenda.presenca_registrada",
    titulo: "Atualizacao de presenca do agendamento",
    mensagem: `O agendamento "${meta.tituloEvento}" foi atualizado para ${meta.statusPresenca.toLowerCase()}.`,
    recipients,
    referenciaTipo: "agenda_evento",
    referenciaId: evento?._id,
    payload: {
      meta,
    },
  });
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
  getSessionUser,
  canViewAll,
  canAssignOthers,
  canManageRooms,
  canMutateEvent,
  canRegisterAttendance,
  parseBoolean,
  toDateTimeLabel,
  parseDateInput,
  getMonthRange,
  getStatusAgendamentoForPresence,
  sanitizeTitle,
  sanitizeSalaNome,
  sanitizeSalaDescricao,
  isProvided,
  isDuplicateKeyError,
  mapSala,
  mapEvento,
  loadEventoById,
  carregarEventoDetalhado,
  dispatchPresenceNotifications,
  resolveRelations,
  resolveSalaSelection,
};
