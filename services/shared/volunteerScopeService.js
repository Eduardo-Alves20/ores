const mongoose = require("mongoose");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { Atendimento } = require("../../schemas/social/Atendimento");
const { PERMISSIONS } = require("../../config/permissions");
const { isAdminProfile, normalizeProfileValue, PERFIS } = require("../../config/roles");
const { hasAnyPermission } = require("./accessControlService");

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function hasOwnAssistidosScope(user) {
  const normalizedProfile = normalizeProfileValue(user?.perfil);
  if (normalizedProfile === PERFIS.SUPERADMIN || normalizedProfile === PERFIS.ADMIN) {
    return false;
  }

  if (isAdminProfile(user?.perfil)) {
    return false;
  }

  if (Array.isArray(user?.permissions) && user.permissions.includes("*")) {
    return false;
  }

  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.ASSISTIDOS_SCOPE_OWN]);
}

async function resolveScopedFamilyIds(user) {
  if (!hasOwnAssistidosScope(user)) {
    return null;
  }

  const actorId = asObjectId(user?.id);
  if (!actorId) {
    return [];
  }

  const [agendaIds, atendimentoIds] = await Promise.all([
    AgendaEvento.distinct("familiaId", {
      responsavelId: actorId,
      familiaId: { $ne: null },
      ativo: true,
    }),
    Atendimento.distinct("familiaId", {
      profissionalId: actorId,
      familiaId: { $ne: null },
      ativo: true,
    }),
  ]);

  return Array.from(
    new Set(
      []
        .concat(Array.isArray(agendaIds) ? agendaIds : [])
        .concat(Array.isArray(atendimentoIds) ? atendimentoIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

async function canAccessFamily(user, familiaId) {
  const scopedIds = await resolveScopedFamilyIds(user);
  if (scopedIds === null) return true;
  return scopedIds.includes(String(familiaId || "").trim());
}

async function resolveScopedAssistidoIds(user) {
  if (!hasOwnAssistidosScope(user)) {
    return null;
  }

  const actorId = asObjectId(user?.id);
  if (!actorId) {
    return [];
  }

  const [agendaIds, atendimentoIds] = await Promise.all([
    AgendaEvento.distinct("assistidoId", {
      responsavelId: actorId,
      assistidoId: { $ne: null },
      ativo: true,
    }),
    Atendimento.distinct("assistidoId", {
      profissionalId: actorId,
      assistidoId: { $ne: null },
      ativo: true,
    }),
  ]);

  return Array.from(
    new Set(
      []
        .concat(Array.isArray(agendaIds) ? agendaIds : [])
        .concat(Array.isArray(atendimentoIds) ? atendimentoIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

async function canAccessAssistido(user, assistidoId) {
  const scopedIds = await resolveScopedAssistidoIds(user);
  if (scopedIds === null) return true;
  return scopedIds.includes(String(assistidoId || "").trim());
}

module.exports = {
  asObjectId,
  hasOwnAssistidosScope,
  resolveScopedFamilyIds,
  canAccessFamily,
  resolveScopedAssistidoIds,
  canAccessAssistido,
};
