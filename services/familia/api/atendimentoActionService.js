const { Atendimento } = require("../../../schemas/social/Atendimento");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createFamiliaError } = require("./familiaContextService");
const {
  ensureAccessibleFamily,
  ensurePatientBelongsToFamily,
  ensureOwnScopedProfessional,
  findApprovedVolunteerProfessional,
  hasOwnAssistidosScope,
  loadAccessibleAttendance,
} = require("./familiaGuardService");

async function resolveAttendanceProfessional({ user, actorId, profissionalId }) {
  const profissionalSelecionado = String(profissionalId || "").trim();
  const profissional = profissionalSelecionado
    ? await findApprovedVolunteerProfessional(profissionalSelecionado)
    : hasOwnAssistidosScope(user)
      ? await findApprovedVolunteerProfessional(actorId)
      : null;

  if (profissionalSelecionado && !profissional) {
    throw createFamiliaError(
      "Profissional/voluntario informado nao foi encontrado ou nao esta apto para atendimento.",
      400
    );
  }

  ensureOwnScopedProfessional(
    user,
    actorId,
    profissional?._id,
    "Voluntarios de atendimento so podem registrar apontamentos em nome proprio."
  );

  return {
    profissionalSelecionado,
    profissional,
  };
}

async function createAttendance({ user, actorId, familiaId, body = {} }) {
  await ensureAccessibleFamily({
    user,
    familiaId,
    select: "_id ativo",
    requireActive: true,
    notFoundMessage: "Familia nao encontrada ou inativa.",
  });

  const { pacienteId, profissionalId, dataHora, tipo, resumo, proximosPassos } = body;

  if (!resumo || !String(resumo).trim()) {
    throw createFamiliaError("Campo resumo e obrigatorio.", 400);
  }

  if (pacienteId) {
    await ensurePatientBelongsToFamily({ pacienteId, familiaId });
  }

  const { profissional } = await resolveAttendanceProfessional({
    user,
    actorId,
    profissionalId,
  });

  const atendimento = await Atendimento.create({
    familiaId,
    pacienteId: pacienteId || null,
    profissionalId: profissional?._id || null,
    dataHora: dataHora || new Date(),
    tipo: tipo || "outro",
    resumo: String(resumo).trim(),
    proximosPassos,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  return {
    mensagem: "Atendimento registrado com sucesso.",
    atendimento,
    audit: {
      acao: "ATENDIMENTO_CRIADO",
      entidade: "atendimento",
      entidadeId: atendimento._id,
      detalhes: {
        familiaId,
        pacienteId: pacienteId || null,
        profissionalId: profissional?._id || null,
      },
    },
  };
}

async function updateAttendance({ user, actorId, id, body = {} }) {
  const atual = await loadAccessibleAttendance({ id, user });
  if (!atual) return null;

  ensureOwnScopedProfessional(
    user,
    actorId,
    atual.profissionalId,
    "Voluntarios de atendimento so podem editar registros vinculados a si mesmos."
  );

  const { pacienteId, profissionalId, dataHora, tipo, resumo, proximosPassos } = body;
  const patch = {
    atualizadoPor: actorId,
  };

  if (typeof pacienteId !== "undefined") {
    if (!pacienteId) {
      patch.pacienteId = null;
    } else {
      await ensurePatientBelongsToFamily({ pacienteId, familiaId: atual.familiaId });
      patch.pacienteId = pacienteId;
    }
  }

  if (typeof profissionalId !== "undefined") {
    const rawProfissionalId = String(profissionalId || "").trim();
    if (!rawProfissionalId) {
      patch.profissionalId = null;
    } else {
      ensureOwnScopedProfessional(
        user,
        actorId,
        rawProfissionalId,
        "Voluntarios de atendimento so podem manter o proprio nome no atendimento."
      );

      const profissional = await findApprovedVolunteerProfessional(rawProfissionalId);
      if (!profissional) {
        throw createFamiliaError(
          "Profissional/voluntario informado nao foi encontrado ou nao esta apto para atendimento.",
          400
        );
      }
      patch.profissionalId = profissional._id;
    }
  }

  if (typeof dataHora !== "undefined") {
    const parsed = new Date(dataHora);
    if (Number.isNaN(parsed.getTime())) {
      throw createFamiliaError("Data e hora invalidas.", 400);
    }
    patch.dataHora = parsed;
  }

  if (typeof tipo !== "undefined") {
    patch.tipo = tipo || "outro";
  }

  if (typeof resumo !== "undefined") {
    const resumoTrim = String(resumo || "").trim();
    if (!resumoTrim) {
      throw createFamiliaError("Campo resumo e obrigatorio.", 400);
    }
    patch.resumo = resumoTrim;
  }

  if (typeof proximosPassos !== "undefined") {
    patch.proximosPassos = proximosPassos;
  }

  const atendimento = await Atendimento.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  return {
    mensagem: "Atendimento atualizado com sucesso.",
    atendimento,
    audit: {
      acao: "ATENDIMENTO_ATUALIZADO",
      entidade: "atendimento",
      entidadeId: id,
      detalhes: {
        familiaId: atendimento?.familiaId,
        pacienteId: atendimento?.pacienteId,
        profissionalId: atendimento?.profissionalId,
      },
    },
  };
}

async function changeAttendanceStatus({ user, actorId, id, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createFamiliaError("Campo ativo e obrigatorio.", 400);
  }

  const atual = await loadAccessibleAttendance({ id, user });
  if (!atual) return null;

  const atendimento = await Atendimento.findByIdAndUpdate(
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
    mensagem: "Status do atendimento atualizado com sucesso.",
    atendimento,
    audit: {
      acao: ativo ? "ATENDIMENTO_REATIVADO" : "ATENDIMENTO_INATIVADO",
      entidade: "atendimento",
      entidadeId: id,
      detalhes: {
        familiaId: atendimento?.familiaId,
        pacienteId: atendimento?.pacienteId,
      },
    },
  };
}

module.exports = {
  changeAttendanceStatus,
  createAttendance,
  resolveAttendanceProfessional,
  updateAttendance,
};
