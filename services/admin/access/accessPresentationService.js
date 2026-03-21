const Usuario = require("../../../schemas/core/Usuario");
const {
  PERFIS,
  getProfileLabel,
} = require("../../../config/roles");

function statusLabel(statusAprovacao) {
  const value = String(statusAprovacao || "aprovado").toLowerCase();
  if (value === "aprovado") return "Aprovado";
  if (value === "rejeitado") return "Rejeitado";
  return "Pendente";
}

function statusClass(statusAprovacao) {
  const value = String(statusAprovacao || "aprovado").toLowerCase();
  if (value === "aprovado") return "status-active";
  if (value === "rejeitado") return "status-inactive";
  return "status-pending";
}

function perfilLabel(perfil) {
  return getProfileLabel(perfil);
}

function tipoLabel(tipoCadastro) {
  const value = String(tipoCadastro || "").toLowerCase();
  if (value === "familia") return "Família";
  if (value === "orgao_publico") return "Órgão Público";
  return "Voluntário";
}

function buildPageBase({ title, sectionTitle, navKey }) {
  return {
    title,
    sectionTitle,
    navKey,
    layout: "partials/app.ejs",
    pageClass: "page-acessos",
    extraCss: ["/css/acessos.css"],
    extraJs: [
      "/js/acessos-shared.js",
      "/js/acessos-user-modal.js",
      "/js/acessos-approval-modal.js",
      "/js/acessos.js",
    ],
  };
}

async function buildResumo(config = {}) {
  const base = config.showAllUsers
    ? {}
    : {
        tipoCadastro: config.tipoCadastro,
        perfil: PERFIS.USUARIO,
      };

  const [total, pendentes, aprovados, ativos] = await Promise.all([
    Usuario.countDocuments(base),
    Usuario.countDocuments({ ...base, statusAprovacao: "pendente" }),
    Usuario.countDocuments({
      ...base,
      $or: [{ statusAprovacao: "aprovado" }, { statusAprovacao: { $exists: false } }],
    }),
    Usuario.countDocuments({ ...base, ativo: true }),
  ]);

  return { total, pendentes, aprovados, ativos };
}

module.exports = {
  statusLabel,
  statusClass,
  perfilLabel,
  tipoLabel,
  buildPageBase,
  buildResumo,
};
