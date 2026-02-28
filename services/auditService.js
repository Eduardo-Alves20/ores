const AuditTrail = require("../schemas/AuditTrail");

async function registrarAuditoria(req, payload) {
  try {
    const ator = req?.session?.user || null;
    const ip = req?.headers?.["x-forwarded-for"] || req?.connection?.remoteAddress || "";

    await AuditTrail.create({
      atorId: ator?.id || null,
      atorNome: ator?.nome || "",
      acao: payload.acao,
      entidade: payload.entidade,
      entidadeId: payload.entidadeId ? String(payload.entidadeId) : "",
      detalhes: payload.detalhes || {},
      ip: Array.isArray(ip) ? ip[0] : String(ip),
      userAgent: req?.headers?.["user-agent"] || "",
    });
  } catch (error) {
    console.error("Falha ao registrar auditoria:", error.message);
  }
}

module.exports = {
  registrarAuditoria,
};

