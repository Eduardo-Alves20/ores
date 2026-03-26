const { Paciente } = require("../../../schemas/social/Paciente");
const { parseBoolean } = require("../../shared/valueParsingService");
const { ensureAccessibleFamily } = require("./familiaGuardService");

async function listPatientsByFamily({ user, familiaId, query = {} }) {
  const ativo = parseBoolean(query.ativo);
  const familia = await ensureAccessibleFamily({ user, familiaId, select: "_id" });

  const filtro = { familiaId: familia._id };
  if (typeof ativo !== "undefined") filtro.ativo = ativo;

  const pacientes = await Paciente.find(filtro).sort({ nome: 1 }).lean();
  return { pacientes };
}

module.exports = {
  listPatientsByFamily,
};
