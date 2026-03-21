const { AgendaSala } = require("../../../schemas/social/AgendaSala");
const { asObjectId } = require("../../agendaAvailabilityService");
const { canManageRooms } = require("./agendaPermissionService");
const { createAgendaError } = require("./agendaErrorService");
const {
  isDuplicateKeyError,
  parseBoolean,
  sanitizeSalaDescricao,
  sanitizeSalaNome,
} = require("./agendaDateValueService");
const { mapSala } = require("./agendaMappingService");

async function createAgendaRoom(user, body = {}) {
  if (!user || !canManageRooms(user)) {
    throw createAgendaError(403, "Sem permissao para cadastrar salas.");
  }

  const actorId = asObjectId(user.id);
  const nome = sanitizeSalaNome(body?.nome);
  const descricao = sanitizeSalaDescricao(body?.descricao);

  if (!nome) {
    throw createAgendaError(400, "Nome da sala e obrigatorio.");
  }

  try {
    const sala = await AgendaSala.create({
      nome,
      descricao,
      ativo: true,
      criadoPor: actorId,
      atualizadoPor: actorId,
    });

    return {
      mensagem: "Sala criada com sucesso.",
      sala: mapSala(sala),
      audit: {
        acao: "AGENDA_SALA_CRIADA",
        entidade: "agenda_sala",
        entidadeId: sala._id,
      },
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw createAgendaError(409, "Ja existe uma sala com esse nome.");
    }
    throw error;
  }
}

async function updateAgendaRoom(user, salaId, body = {}) {
  if (!user || !canManageRooms(user)) {
    throw createAgendaError(403, "Sem permissao para editar salas.");
  }

  const sala = await AgendaSala.findById(salaId);
  if (!sala) {
    throw createAgendaError(404, "Sala nao encontrada.");
  }

  const nome = sanitizeSalaNome(body?.nome);
  const descricao = sanitizeSalaDescricao(body?.descricao);
  if (!nome) {
    throw createAgendaError(400, "Nome da sala e obrigatorio.");
  }

  try {
    sala.nome = nome;
    sala.descricao = descricao;
    sala.atualizadoPor = asObjectId(user.id);
    await sala.save();

    return {
      mensagem: "Sala atualizada com sucesso.",
      sala: mapSala(sala),
      audit: {
        acao: "AGENDA_SALA_ATUALIZADA",
        entidade: "agenda_sala",
        entidadeId: sala._id,
      },
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw createAgendaError(409, "Ja existe uma sala com esse nome.");
    }
    throw error;
  }
}

async function changeAgendaRoomStatus(user, salaId, ativoInput) {
  if (!user || !canManageRooms(user)) {
    throw createAgendaError(403, "Sem permissao para alterar salas.");
  }

  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createAgendaError(400, "Campo ativo e obrigatorio.");
  }

  const sala = await AgendaSala.findById(salaId);
  if (!sala) {
    throw createAgendaError(404, "Sala nao encontrada.");
  }

  sala.ativo = ativo;
  sala.atualizadoPor = asObjectId(user.id);
  sala.inativadoEm = ativo ? null : new Date();
  sala.inativadoPor = ativo ? null : asObjectId(user.id);
  await sala.save();

  return {
    mensagem: "Status da sala atualizado com sucesso.",
    sala: mapSala(sala),
    audit: {
      acao: ativo ? "AGENDA_SALA_REATIVADA" : "AGENDA_SALA_INATIVADA",
      entidade: "agenda_sala",
      entidadeId: sala._id,
    },
  };
}

module.exports = {
  createAgendaRoom,
  updateAgendaRoom,
  changeAgendaRoomStatus,
};
