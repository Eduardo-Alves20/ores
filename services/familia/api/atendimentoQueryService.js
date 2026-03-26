const { Atendimento } = require("../../../schemas/social/Atendimento");
const { parseBoolean } = require("../../shared/valueParsingService");
const { ensureAccessibleFamily } = require("./familiaGuardService");

async function listAttendancesByFamily({ user, familiaId, query = {} }) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const ativo = parseBoolean(query.ativo);

  const familia = await ensureAccessibleFamily({ user, familiaId, select: "_id" });

  const filtro = { familiaId: familia._id };
  if (typeof ativo !== "undefined") filtro.ativo = ativo;

  return Atendimento.paginate(filtro, {
    page,
    limit,
    sort: "-dataHora",
    populate: {
      path: "profissionalId",
      select: "nome login email",
    },
    lean: true,
  });
}

module.exports = {
  listAttendancesByFamily,
};
