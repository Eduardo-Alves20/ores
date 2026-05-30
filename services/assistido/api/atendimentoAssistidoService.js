const { Atendimento, TIPOS_ATENDIMENTO } = require("../../../schemas/social/Atendimento");
const { PERFIS } = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createAssistidoError } = require("./assistidoContextService");
const { ensureAssistidoAcessivel } = require("./assistidoGuardService");
const {
  ensureOwnScopedProfessional,
  findApprovedVolunteerProfessional,
  hasOwnAssistidosScope,
  loadAccessibleAttendance,
} = require("../../shared/atendimentoScopeService");

function isElevatedProfile(user) {
  const perfil = String(user?.perfil || "").trim().toLowerCase();
  return perfil === PERFIS.ADMIN || perfil === PERFIS.SUPERADMIN;
}

function canReadByScope({ atendimento, user }) {
  if (!atendimento || !user) return false;
  if (isElevatedProfile(user)) return true;

  const userId = String(user.id || "");
  const ownerId = String(atendimento.ownerId || atendimento.criadoPor || "");
  const profissionalId = String(atendimento.profissionalId?._id || atendimento.profissionalId || "");
  const careTeamIds = Array.isArray(atendimento.careTeamIds)
    ? atendimento.careTeamIds.map((item) => String(item?._id || item || ""))
    : [];
  const isOwner = ownerId && ownerId === userId;
  const isCareTeam = profissionalId === userId || careTeamIds.includes(userId);
  const scope = String(atendimento.visibilityScope || "care_team").trim().toLowerCase();

  if (scope === "owner_only") return isOwner;
  return isOwner || isCareTeam;
}

function ensureCreatePermissionByRecordType({ user, registroTipo }) {
  const tipo = String(registroTipo || "atendimento_geral").trim().toLowerCase();
  const permissionByType = {
    entrevista_social: PERMISSIONS.ENTREVISTA_SOCIAL_CREATE,
    relatorio_triagem: PERMISSIONS.RELATORIO_TRIAGEM_CREATE,
    anamnese: PERMISSIONS.ANAMNESE_CREATE_UPDATE,
    relatorio_individual: PERMISSIONS.RELATORIO_INDIVIDUAL_CREATE_UPDATE,
    relatorio_evolucao: PERMISSIONS.RELATORIO_EVOLUCAO_CREATE_UPDATE,
    relatorio_geral: PERMISSIONS.RELATORIO_GERAL_READ_CARE_TEAM,
  };
  const requiredPermission = permissionByType[tipo] || PERMISSIONS.ATENDIMENTOS_CREATE;

  if (!hasAnyPermission(user?.permissions || [], [requiredPermission])) {
    throw createAssistidoError("Sem permissao para criar este tipo de registro.", 403);
  }
}

function normalizeAttendanceType(tipo) {
  const normalized = String(tipo || "").trim().toLowerCase();
  if (!normalized) return "outro";
  if (!TIPOS_ATENDIMENTO.includes(normalized)) {
    throw createAssistidoError("Tipo de atendimento invalido.", 400);
  }
  return normalized;
}

async function resolveAttendanceProfessional({ user, actorId, profissionalId }) {
  const profissionalSelecionado = String(profissionalId || "").trim();
  const profissional = profissionalSelecionado
    ? await findApprovedVolunteerProfessional(profissionalSelecionado)
    : hasOwnAssistidosScope(user)
      ? await findApprovedVolunteerProfessional(actorId)
      : null;

  if (profissionalSelecionado && !profissional) {
    throw createAssistidoError(
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

  return { profissional };
}

async function createAttendanceForAssistido({ user, actorId, assistidoId, body = {} }) {
  const assistido = await ensureAssistidoAcessivel({
    user,
    assistidoId,
    select: "_id ativo",
    requireActive: true,
    notFoundMessage: "Assistido nao encontrado ou inativo.",
  });

  const { profissionalId, dataHora, tipo, resumo, proximosPassos, notasPrivadas } = body;
  const registroTipo = String(body?.registroTipo || "atendimento_geral").trim().toLowerCase();
  const visibilityScope = String(body?.visibilityScope || "").trim().toLowerCase();
  ensureCreatePermissionByRecordType({ user, registroTipo });

  if (!resumo || !String(resumo).trim()) {
    throw createAssistidoError("Campo resumo e obrigatorio.", 400);
  }

  const { profissional } = await resolveAttendanceProfessional({ user, actorId, profissionalId });

  const atendimento = await Atendimento.create({
    assistidoId: assistido._id,
    profissionalId: profissional?._id || null,
    dataHora: dataHora || new Date(),
    tipo: normalizeAttendanceType(tipo),
    resumo: String(resumo).trim(),
    proximosPassos,
    notasPrivadas: notasPrivadas ? String(notasPrivadas).trim() : null,
    registroTipo,
    visibilityScope:
      visibilityScope ||
      (registroTipo === "entrevista_social" || registroTipo === "relatorio_triagem"
        ? "owner_only"
        : "care_team"),
    ownerId: actorId,
    careTeamIds: profissional?._id ? [profissional._id] : [],
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
        assistidoId: assistido._id,
        profissionalId: profissional?._id || null,
      },
    },
  };
}

async function listAttendancesByAssistido({ user, assistidoId, query = {} }) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const ativo = parseBoolean(query.ativo);

  const assistido = await ensureAssistidoAcessivel({ user, assistidoId, select: "_id" });

  const filtro = { assistidoId: assistido._id };
  if (typeof ativo !== "undefined") filtro.ativo = ativo;

  const result = await Atendimento.paginate(filtro, {
    page,
    limit,
    sort: "-dataHora",
    populate: { path: "profissionalId", select: "nome login email" },
    lean: true,
  });

  const userId = String(user?.id || "");
  result.docs = result.docs
    .map((doc) => {
      if (String(doc.ownerId || doc.criadoPor || "") !== userId) {
        const { notasPrivadas, ...rest } = doc;
        return rest;
      }
      return doc;
    })
    .filter((doc) => canReadByScope({ atendimento: doc, user }));

  return result;
}

async function updateAttendance({ user, actorId, id, body = {} }) {
  const atual = await loadAccessibleAttendance({ id, user });
  if (!atual) return null;
  if (!canReadByScope({ atendimento: atual, user })) {
    throw createAssistidoError("Sem permissao para acessar este registro.", 403);
  }

  ensureOwnScopedProfessional(
    user,
    actorId,
    atual.profissionalId,
    "Voluntarios de atendimento so podem editar registros vinculados a si mesmos."
  );

  const { profissionalId, dataHora, tipo, resumo, proximosPassos, notasPrivadas } = body;
  const patch = { atualizadoPor: actorId };

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
        throw createAssistidoError(
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
      throw createAssistidoError("Data e hora invalidas.", 400);
    }
    patch.dataHora = parsed;
  }

  if (typeof tipo !== "undefined") {
    patch.tipo = normalizeAttendanceType(tipo);
  }

  if (typeof resumo !== "undefined") {
    const resumoTrim = String(resumo || "").trim();
    if (!resumoTrim) {
      throw createAssistidoError("Campo resumo e obrigatorio.", 400);
    }
    patch.resumo = resumoTrim;
  }

  if (typeof proximosPassos !== "undefined") {
    patch.proximosPassos = proximosPassos;
  }

  if (typeof notasPrivadas !== "undefined") {
    const isOwner = String(atual.ownerId || atual.criadoPor || "") === String(actorId || "");
    if (isOwner) {
      patch.notasPrivadas = notasPrivadas ? String(notasPrivadas).trim() : null;
    }
  }

  if (typeof body.visibilityScope !== "undefined") {
    const isOwner = String(atual.ownerId || atual.criadoPor || "") === String(actorId || "");
    if (isOwner || isElevatedProfile(user)) {
      patch.visibilityScope = String(body.visibilityScope || "").trim().toLowerCase() || "care_team";
    }
  }

  const atendimento = await Atendimento.findByIdAndUpdate(atual._id, patch, {
    new: true,
    runValidators: true,
  });

  return {
    mensagem: "Atendimento atualizado com sucesso.",
    atendimento,
    audit: {
      acao: "ATENDIMENTO_ATUALIZADO",
      entidade: "atendimento",
      entidadeId: atual._id,
      detalhes: { assistidoId: atendimento?.assistidoId, profissionalId: atendimento?.profissionalId },
    },
  };
}

async function changeAttendanceStatus({ user, actorId, id, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createAssistidoError("Campo ativo e obrigatorio.", 400);
  }

  const atual = await loadAccessibleAttendance({ id, user });
  if (!atual) return null;
  if (!canReadByScope({ atendimento: atual, user })) {
    throw createAssistidoError(
      "Voluntarios de atendimento so podem alterar status de registros vinculados a si mesmos.",
      403
    );
  }

  ensureOwnScopedProfessional(
    user,
    actorId,
    atual.profissionalId,
    "Voluntarios de atendimento so podem alterar status de registros vinculados a si mesmos."
  );

  const atendimento = await Atendimento.findByIdAndUpdate(
    atual._id,
    {
      ativo,
      atualizadoPor: actorId,
      inativadoEm: ativo ? null : new Date(),
      inativadoPor: ativo ? null : actorId,
    },
    { new: true, runValidators: true }
  );

  return {
    mensagem: "Status do atendimento atualizado com sucesso.",
    atendimento,
    audit: {
      acao: ativo ? "ATENDIMENTO_REATIVADO" : "ATENDIMENTO_INATIVADO",
      entidade: "atendimento",
      entidadeId: atual._id,
      detalhes: { assistidoId: atendimento?.assistidoId },
    },
  };
}

module.exports = {
  createAttendanceForAssistido,
  listAttendancesByAssistido,
  updateAttendance,
  changeAttendanceStatus,
};
