const Familia = require("../../../schemas/social/Familia");
const { normalizeCustomFieldValues } = require("../../shared/systemConfigService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createFamiliaError } = require("./familiaContextService");
const { ensureAccessibleFamily } = require("./familiaGuardService");
const {
  isPlainObject,
  normalizeFamilyAddress,
  normalizeFamilyObservacoes,
  normalizeFamilyResponsible,
} = require("./familiaInputService");

async function createFamily({ actorId, body = {} }) {
  const responsavel = normalizeFamilyResponsible(body?.responsavel);
  const endereco = normalizeFamilyAddress(body?.endereco);
  const observacoes = normalizeFamilyObservacoes(body?.observacoes);
  const camposExtras = body?.camposExtras || {};
  const nome = responsavel.nome;
  const telefone = responsavel.telefone;

  if (!nome || !telefone) {
    throw createFamiliaError("Campos obrigatorios do responsavel: nome e telefone.", 400);
  }

  const normalizedCamposExtras = await normalizeCustomFieldValues("familia", camposExtras);
  const familia = await Familia.create({
    responsavel: {
      nome,
      telefone,
      email: responsavel.email || undefined,
      parentesco: responsavel.parentesco || "responsavel",
    },
    endereco,
    observacoes,
    camposExtras: normalizedCamposExtras,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  return {
    mensagem: "Familia cadastrada com sucesso.",
    familia,
    audit: {
      acao: "FAMILIA_CRIADA",
      entidade: "familia",
      entidadeId: familia._id,
    },
  };
}

async function updateFamily({ id, user, actorId, body = {} }) {
  await ensureAccessibleFamily({
    user,
    familiaId: id,
    select: "_id",
    notFoundMessage: "Familia nao encontrada.",
  });

  const { responsavel, endereco, observacoes, camposExtras } = body;
  const patch = {
    atualizadoPor: actorId,
  };

  if (isPlainObject(responsavel)) {
    const normalizedResponsavel = normalizeFamilyResponsible(responsavel);

    if (Object.prototype.hasOwnProperty.call(responsavel, "nome")) {
      if (!normalizedResponsavel.nome) {
        throw createFamiliaError("Campo nome do responsavel e obrigatorio.", 400);
      }
      patch["responsavel.nome"] = normalizedResponsavel.nome;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "telefone")) {
      if (!normalizedResponsavel.telefone) {
        throw createFamiliaError("Campo telefone do responsavel e obrigatorio.", 400);
      }
      patch["responsavel.telefone"] = normalizedResponsavel.telefone;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "email")) {
      patch["responsavel.email"] = normalizedResponsavel.email;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "parentesco")) {
      patch["responsavel.parentesco"] = normalizedResponsavel.parentesco;
    }
  }

  if (typeof observacoes !== "undefined") {
    patch.observacoes = normalizeFamilyObservacoes(observacoes);
  }
  if (typeof endereco !== "undefined") {
    patch.endereco = normalizeFamilyAddress(endereco);
  }
  if (typeof camposExtras !== "undefined") {
    patch.camposExtras = await normalizeCustomFieldValues("familia", camposExtras || {});
  }

  const familia = await Familia.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  if (!familia) {
    return null;
  }

  return {
    mensagem: "Familia atualizada com sucesso.",
    familia,
    audit: {
      acao: "FAMILIA_ATUALIZADA",
      entidade: "familia",
      entidadeId: id,
    },
  };
}

async function changeFamilyStatus({ id, user, actorId, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createFamiliaError("Campo ativo e obrigatorio.", 400);
  }

  await ensureAccessibleFamily({
    user,
    familiaId: id,
    select: "_id",
    notFoundMessage: "Familia nao encontrada.",
  });

  const patch = {
    ativo,
    atualizadoPor: actorId,
    inativadoEm: ativo ? null : new Date(),
    inativadoPor: ativo ? null : actorId,
  };

  const familia = await Familia.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  if (!familia) {
    return null;
  }

  return {
    mensagem: "Status da familia atualizado com sucesso.",
    familia,
    audit: {
      acao: ativo ? "FAMILIA_REATIVADA" : "FAMILIA_INATIVADA",
      entidade: "familia",
      entidadeId: id,
    },
  };
}

module.exports = {
  changeFamilyStatus,
  createFamily,
  updateFamily,
};
