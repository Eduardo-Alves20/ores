const Familia = require("../../../schemas/social/Familia");
const { normalizeCustomFieldValues } = require("../../systemConfigService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createFamiliaError } = require("./familiaContextService");

async function createFamily({ actorId, body = {} }) {
  const { responsavel = {}, endereco = {}, observacoes, camposExtras = {} } = body;
  const nome = String(responsavel.nome || "").trim();
  const telefone = String(responsavel.telefone || "").trim();
  const email = String(responsavel.email || "").trim().toLowerCase();
  const parentesco = String(responsavel.parentesco || "responsavel").trim();

  if (!nome || !telefone) {
    throw createFamiliaError("Campos obrigatorios do responsavel: nome e telefone.", 400);
  }

  const normalizedCamposExtras = await normalizeCustomFieldValues("familia", camposExtras);
  const familia = await Familia.create({
    responsavel: {
      nome,
      telefone,
      email: email || undefined,
      parentesco: parentesco || "responsavel",
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

async function updateFamily({ id, actorId, body = {} }) {
  const { responsavel, endereco, observacoes, camposExtras } = body;
  const patch = {
    atualizadoPor: actorId,
  };

  if (responsavel) {
    if (typeof responsavel.nome !== "undefined") {
      patch["responsavel.nome"] = String(responsavel.nome).trim();
    }
    if (typeof responsavel.telefone !== "undefined") {
      patch["responsavel.telefone"] = String(responsavel.telefone).trim();
    }
    if (typeof responsavel.email !== "undefined") {
      patch["responsavel.email"] = String(responsavel.email || "").trim().toLowerCase();
    }
    if (typeof responsavel.parentesco !== "undefined") {
      patch["responsavel.parentesco"] = String(responsavel.parentesco || "responsavel").trim();
    }
  }

  if (typeof observacoes !== "undefined") patch.observacoes = observacoes;
  if (typeof endereco !== "undefined") patch.endereco = endereco;
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

async function changeFamilyStatus({ id, actorId, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createFamiliaError("Campo ativo e obrigatorio.", 400);
  }

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
