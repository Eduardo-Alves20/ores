const AuditTrail = require("../../../schemas/core/AuditTrail");
const { PERFIS } = require("../../../config/roles");
const {
  buildNotificacoesViewModel,
  mapActionLabel,
  mapEntityLabel,
  NOTIFICATION_LIMIT_OPTIONS,
} = require("./contaPresentationService");

function parseNotificacaoTipo(tipo) {
  const value = String(tipo || "").trim().toLowerCase();
  if (value === "alert" || value === "info") return value;
  return "todos";
}

function parseNotificacaoLimit(limit, fallback = 40) {
  const parsed = Number.parseInt(String(limit || ""), 10);
  if (NOTIFICATION_LIMIT_OPTIONS.includes(parsed)) return parsed;
  return fallback;
}

function buildNotificacaoTipoFiltro(tipo) {
  if (tipo === "alert") {
    return { acao: /FALHA/i };
  }

  if (tipo === "info") {
    return { acao: { $not: /FALHA/i } };
  }

  return {};
}

function buildBaseNotificationFilter({ userId, profile }) {
  if (profile === PERFIS.ADMIN || profile === PERFIS.SUPERADMIN) {
    return {};
  }

  return {
    $or: [{ atorId: userId }, { entidade: "usuario", entidadeId: String(userId) }],
  };
}

function mapNotificacao(item) {
  const tipo = String(item?.acao || "").includes("FALHA") ? "alert" : "info";
  const resumo = item?.atorNome ? `Por ${item.atorNome}` : "Evento do sistema";

  return {
    _id: String(item?._id || ""),
    tipo,
    tipoLabel: tipo === "alert" ? "Alerta" : "Informativa",
    titulo: mapActionLabel(item?.acao),
    mensagem: `${resumo} em ${mapEntityLabel(item?.entidade)}${
      item?.entidadeId ? ` (${String(item.entidadeId).slice(-6)})` : ""
    }`,
    criadoEm: item?.createdAt || null,
    criadoEmIso: item?.createdAt ? new Date(item.createdAt).toISOString() : "",
    entidadeLabel: mapEntityLabel(item?.entidade),
  };
}

async function buildNotificationsPageView({ userId, profile, query = {} }) {
  const filtroBase = buildBaseNotificationFilter({ userId, profile });
  const defaultLimit = profile === PERFIS.ADMIN || profile === PERFIS.SUPERADMIN ? 60 : 40;
  const tipoAtual = parseNotificacaoTipo(query?.tipo);
  const limitAtual = parseNotificacaoLimit(query?.limit, defaultLimit);
  const filtroTipo = buildNotificacaoTipoFiltro(tipoAtual);
  const filtroLista = { ...filtroBase, ...filtroTipo };

  const [docs, totalGeral, totalAlertas] = await Promise.all([
    AuditTrail.find(filtroLista).sort({ createdAt: -1 }).limit(limitAtual).lean(),
    AuditTrail.countDocuments(filtroBase),
    AuditTrail.countDocuments({ ...filtroBase, acao: /FALHA/i }),
  ]);

  const notificacoes = docs.map(mapNotificacao);
  const totais = {
    total: totalGeral,
    alertas: totalAlertas,
    informativas: Math.max(totalGeral - totalAlertas, 0),
    listadas: notificacoes.length,
  };

  return buildNotificacoesViewModel({
    notificacoes,
    totais,
    filtros: {
      tipo: tipoAtual,
      limit: limitAtual,
    },
  });
}

module.exports = {
  buildNotificationsPageView,
  buildBaseNotificationFilter,
  buildNotificacaoTipoFiltro,
  mapNotificacao,
  parseNotificacaoLimit,
  parseNotificacaoTipo,
};
