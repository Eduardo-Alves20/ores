const { Atendimento } = require("../../../schemas/social/Atendimento");
const { PERFIS } = require("../../../config/roles");
const { parseBoolean } = require("../../shared/valueParsingService");
const { ensureAccessibleFamily } = require("./familiaGuardService");

function isElevatedProfile(user) {
  const perfil = String(user?.perfil || "").trim().toLowerCase();
  return perfil === PERFIS.ADMIN || perfil === PERFIS.SUPERADMIN;
}

function canReadByScope(doc, user) {
  if (isElevatedProfile(user)) return true;

  const userId = String(user?.id || "");
  const ownerId = String(doc?.ownerId || doc?.criadoPor || "");
  const profissionalId = String(doc?.profissionalId?._id || doc?.profissionalId || "");
  const careTeamIds = Array.isArray(doc?.careTeamIds)
    ? doc.careTeamIds.map((item) => String(item?._id || item || ""))
    : [];
  const scope = String(doc?.visibilityScope || "care_team").trim().toLowerCase();
  const isOwner = ownerId && ownerId === userId;
  const isCareTeam = profissionalId === userId || careTeamIds.includes(userId);

  if (scope === "owner_only") return isOwner;
  return isOwner || isCareTeam;
}

async function listAttendancesByFamily({ user, familiaId, query = {} }) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const ativo = parseBoolean(query.ativo);

  const familia = await ensureAccessibleFamily({ user, familiaId, select: "_id" });

  const filtro = { familiaId: familia._id };
  if (typeof ativo !== "undefined") filtro.ativo = ativo;

  const result = await Atendimento.paginate(filtro, {
    page,
    limit,
    sort: "-dataHora",
    populate: {
      path: "profissionalId",
      select: "nome login email",
    },
    lean: true,
  });

  const userId = String(user?.id || "");
  result.docs = result.docs.map((doc) => {
    if (String(doc.ownerId || doc.criadoPor || "") !== userId) {
      const { notasPrivadas, ...rest } = doc;
      return rest;
    }
    return doc;
  }).filter((doc) => canReadByScope(doc, user));

  return result;
}

module.exports = {
  listAttendancesByFamily,
};
