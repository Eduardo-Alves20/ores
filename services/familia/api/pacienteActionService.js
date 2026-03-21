const { Paciente } = require("../../../schemas/social/Paciente");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createFamiliaError } = require("./familiaContextService");
const {
  ensureAccessibleFamily,
  loadAccessiblePatient,
} = require("./familiaGuardService");

async function createPatient({ user, actorId, familiaId, body = {} }) {
  await ensureAccessibleFamily({
    user,
    familiaId,
    select: "_id ativo",
    requireActive: true,
    notFoundMessage: "Familia nao encontrada ou inativa.",
  });

  const {
    nome,
    dataNascimento,
    tipoDeficiencia,
    necessidadesApoio,
    observacoes,
    diagnosticoResumo,
  } = body;

  if (!nome) {
    throw createFamiliaError("Campo nome e obrigatorio.", 400);
  }

  const paciente = await Paciente.create({
    familiaId,
    nome: String(nome).trim(),
    dataNascimento: dataNascimento || null,
    tipoDeficiencia: tipoDeficiencia || "outra",
    necessidadesApoio,
    observacoes,
    diagnosticoResumo,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  return {
    mensagem: "Paciente cadastrado com sucesso.",
    paciente,
    audit: {
      acao: "PACIENTE_CRIADO",
      entidade: "paciente",
      entidadeId: paciente._id,
      detalhes: { familiaId },
    },
  };
}

async function updatePatient({ user, actorId, id, body = {} }) {
  const atual = await loadAccessiblePatient({ id, user });
  if (!atual) return null;

  const {
    nome,
    dataNascimento,
    tipoDeficiencia,
    necessidadesApoio,
    observacoes,
    diagnosticoResumo,
  } = body;

  const patch = {
    atualizadoPor: actorId,
  };

  if (typeof nome !== "undefined") patch.nome = String(nome).trim();
  if (typeof dataNascimento !== "undefined") patch.dataNascimento = dataNascimento || null;
  if (typeof tipoDeficiencia !== "undefined") patch.tipoDeficiencia = tipoDeficiencia || "outra";
  if (typeof necessidadesApoio !== "undefined") patch.necessidadesApoio = necessidadesApoio;
  if (typeof observacoes !== "undefined") patch.observacoes = observacoes;
  if (typeof diagnosticoResumo !== "undefined") patch.diagnosticoResumo = diagnosticoResumo;

  const paciente = await Paciente.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  return {
    mensagem: "Paciente atualizado com sucesso.",
    paciente,
    audit: {
      acao: "PACIENTE_ATUALIZADO",
      entidade: "paciente",
      entidadeId: id,
      detalhes: { familiaId: paciente?.familiaId },
    },
  };
}

async function changePatientStatus({ user, actorId, id, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createFamiliaError("Campo ativo e obrigatorio.", 400);
  }

  const atual = await loadAccessiblePatient({ id, user });
  if (!atual) return null;

  const paciente = await Paciente.findByIdAndUpdate(
    id,
    {
      ativo,
      atualizadoPor: actorId,
      inativadoEm: ativo ? null : new Date(),
      inativadoPor: ativo ? null : actorId,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return {
    mensagem: "Status do paciente atualizado com sucesso.",
    paciente,
    audit: {
      acao: ativo ? "PACIENTE_REATIVADO" : "PACIENTE_INATIVADO",
      entidade: "paciente",
      entidadeId: id,
      detalhes: { familiaId: paciente?.familiaId },
    },
  };
}

module.exports = {
  changePatientStatus,
  createPatient,
  updatePatient,
};
