const { AgendaHistorico } = require("../../schemas/social/AgendaHistorico");
const { normalizeProfileValue } = require("../../config/roles");

async function registrarHistoricoAgenda({
  req = null,
  eventoId,
  tipo,
  titulo,
  descricao = "",
  visibilidade = "interna",
  detalhes = {},
  ator = null,
}) {
  try {
    const sessUser = req?.session?.user || null;
    const actor = ator || sessUser || null;

    if (!eventoId || !tipo || !titulo) {
      return null;
    }

    return await AgendaHistorico.create({
      eventoId,
      atorId: actor?.id || actor?._id || null,
      atorNome: String(actor?.nome || actor?.email || "").trim(),
      atorPerfil: normalizeProfileValue(actor?.perfil, String(actor?.perfil || "").trim()),
      tipo,
      visibilidade,
      titulo,
      descricao,
      detalhes: detalhes && typeof detalhes === "object" ? detalhes : {},
    });
  } catch (error) {
    console.error("Falha ao registrar historico da agenda:", error.message);
    return null;
  }
}

async function listarHistoricoAgenda(eventoId, limit = 12) {
  if (!eventoId) return [];

  return AgendaHistorico.find({ eventoId })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 12, 50)))
    .lean();
}

module.exports = {
  registrarHistoricoAgenda,
  listarHistoricoAgenda,
};
