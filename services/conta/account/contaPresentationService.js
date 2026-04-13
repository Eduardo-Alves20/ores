const { PERFIS_LIST, getProfileLabel } = require("../../../config/roles");

const NOTIFICATION_LIMIT_OPTIONS = Object.freeze([10, 20, 40, 60, 100]);

function mapTipoCadastroLabel(tipoCadastro) {
  if (tipoCadastro === "familia") return "Família";
  if (tipoCadastro === "orgao_publico") return "Órgão Público";
  return "Voluntário";
}

function mapPerfilLabel(perfil) {
  return getProfileLabel(perfil);
}

function mapActionLabel(acao) {
  return String(acao || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapEntityLabel(entidade) {
  const value = String(entidade || "").toLowerCase();
  if (value === "auth") return "Autenticacao";
  if (value === "usuario") return "Usuario";
  if (value === "familia") return "Familia";
  if (value === "agenda_evento") return "Agenda";
  if (value === "paciente") return "Paciente";
  if (value === "atendimento") return "Atendimento";
  return value || "Sistema";
}

function buildPerfilViewModel(usuario, flash = {}) {
  const senhaQuery = String(flash.senhaQuery || "").trim().toLowerCase();
  const openSenhaModal = senhaQuery === "1" || senhaQuery === "true";

  return {
    title: "Perfil",
    sectionTitle: "Perfil",
    navKey: "perfil",
    layout: "partials/app.ejs",
    pageClass: "page-conta-perfil",
    usuario,
    perfilLabel: mapPerfilLabel(usuario?.perfil),
    tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
    successMessage: flash.success || [],
    errorMessage: flash.error || [],
    senhaErrorMessage: flash.senhaError || [],
    openSenhaModal,
  };
}

function buildEditPerfilViewModel({
  usuario,
  isAdmin = false,
  isSuperAdmin = false,
  successMessage = [],
  errorMessage = [],
}) {
  return {
    title: "Editar Perfil",
    sectionTitle: "Editar Perfil",
    navKey: "perfil",
    layout: "partials/app.ejs",
    pageClass: "page-conta-perfil-editar",
    extraJs: ["/js/conta-perfil-editar.js"],
    isAdmin,
    isSuperAdmin,
    usuario,
    perfisDisponiveis: PERFIS_LIST,
    successMessage,
    errorMessage,
  };
}

function buildNotificacoesViewModel({ notificacoes, totais, filtros }) {
  return {
    title: "Notificacoes",
    sectionTitle: "Notificacoes",
    navKey: "notificacoes",
    layout: "partials/app.ejs",
    pageClass: "page-conta-notificacoes",
    notificacoes,
    totais,
    filtros: {
      ...filtros,
      limitOptions: NOTIFICATION_LIMIT_OPTIONS,
    },
  };
}

module.exports = {
  NOTIFICATION_LIMIT_OPTIONS,
  buildEditPerfilViewModel,
  buildNotificacoesViewModel,
  buildPerfilViewModel,
  mapActionLabel,
  mapEntityLabel,
  mapPerfilLabel,
  mapTipoCadastroLabel,
};
