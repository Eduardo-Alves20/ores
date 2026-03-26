const {
  Paciente,
  TIPOS_DEFICIENCIA,
} = require("../../../schemas/social/Paciente");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createFamiliaError } = require("./familiaContextService");
const {
  ensureAccessibleFamily,
  loadAccessiblePatient,
} = require("./familiaGuardService");

function normalizePatientName(value, { required = false } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    if (required) {
      throw createFamiliaError("Campo nome e obrigatorio.", 400);
    }
    return "";
  }
  return normalized.slice(0, 160);
}

function normalizePatientBirthDate(value) {
  if (typeof value === "undefined") return undefined;
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createFamiliaError("Data de nascimento invalida.", 400);
  }

  return parsed;
}

function normalizePatientDisabilityType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "outra";
  if (!TIPOS_DEFICIENCIA.includes(normalized)) {
    throw createFamiliaError("Tipo de deficiencia invalido.", 400);
  }
  return normalized;
}

function normalizePatientTextField(value, limit = 3000) {
  return String(value || "").trim().slice(0, limit);
}

async function createPatient({ user, actorId, familiaId, body = {} }) {
  const familia = await ensureAccessibleFamily({
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

  const paciente = await Paciente.create({
    familiaId: familia._id,
    nome: normalizePatientName(nome, { required: true }),
    dataNascimento: normalizePatientBirthDate(dataNascimento) ?? null,
    tipoDeficiencia: normalizePatientDisabilityType(tipoDeficiencia),
    necessidadesApoio: normalizePatientTextField(necessidadesApoio),
    observacoes: normalizePatientTextField(observacoes),
    diagnosticoResumo: normalizePatientTextField(diagnosticoResumo),
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
      detalhes: { familiaId: familia._id },
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

  if (typeof nome !== "undefined") {
    patch.nome = normalizePatientName(nome, { required: true });
  }
  if (typeof dataNascimento !== "undefined") {
    patch.dataNascimento = normalizePatientBirthDate(dataNascimento);
  }
  if (typeof tipoDeficiencia !== "undefined") {
    patch.tipoDeficiencia = normalizePatientDisabilityType(tipoDeficiencia);
  }
  if (typeof necessidadesApoio !== "undefined") {
    patch.necessidadesApoio = normalizePatientTextField(necessidadesApoio);
  }
  if (typeof observacoes !== "undefined") {
    patch.observacoes = normalizePatientTextField(observacoes);
  }
  if (typeof diagnosticoResumo !== "undefined") {
    patch.diagnosticoResumo = normalizePatientTextField(diagnosticoResumo);
  }

  const paciente = await Paciente.findByIdAndUpdate(atual._id, patch, {
    new: true,
    runValidators: true,
  });

  return {
    mensagem: "Paciente atualizado com sucesso.",
    paciente,
    audit: {
      acao: "PACIENTE_ATUALIZADO",
      entidade: "paciente",
      entidadeId: atual._id,
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
    atual._id,
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
      entidadeId: atual._id,
      detalhes: { familiaId: paciente?.familiaId },
    },
  };
}

module.exports = {
  changePatientStatus,
  createPatient,
  normalizePatientBirthDate,
  normalizePatientDisabilityType,
  normalizePatientName,
  updatePatient,
};
