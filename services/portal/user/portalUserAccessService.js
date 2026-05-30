const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");

function hasPerm(user, permission) {
  return hasAnyPermission(user?.permissions || [], [permission]);
}

function buildPortalQuickLinks(user) {
  const links = [];

  if (hasPerm(user, PERMISSIONS.PORTAL_MEUS_DADOS)) {
    links.push({
      href: "/meus-dados",
      label: "Meus Dados",
      description: "Veja seus dados cadastrais e o tipo de acesso liberado.",
      icon: "fa-address-card",
    });
  }

  if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) {
    links.push({
      href: "/painel",
      label: "Painel",
      description: "Acesse indicadores e a visao geral da operacao social.",
      icon: "fa-chart-line",
    });
  }

  if (hasPerm(user, PERMISSIONS.ASSISTIDOS_VIEW)) {
    links.push({
      href: "/assistidos",
      label: "Assistidos",
      description: "Consulte assistidos e acompanhamentos.",
      icon: "fa-people-group",
    });
  }

  if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) {
    links.push({
      href: "/agenda",
      label: "Agenda",
      description: "Visualize compromissos e a organizacao dos atendimentos.",
      icon: "fa-calendar-days",
    });
    links.push({
      href: "/agenda?modal=disponibilidade",
      label: "Minha Disponibilidade",
      description: "Configure seus dias e horarios para liberar agendamento dos assistidos.",
      icon: "fa-clock",
    });
  }

  return links;
}

function buildAccessHighlights(user) {
  const highlights = [];

  if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) highlights.push("Painel executivo");
  if (hasPerm(user, PERMISSIONS.ASSISTIDOS_VIEW)) highlights.push("Consulta de assistidos");
  if (hasPerm(user, PERMISSIONS.ATENDIMENTOS_CREATE)) highlights.push("Registro de atendimentos");
  if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) highlights.push("Agenda");
  if (hasPerm(user, PERMISSIONS.AGENDA_ATTENDANCE)) highlights.push("Presencas");
  if (hasPerm(user, PERMISSIONS.RELATORIOS_VIEW)) highlights.push("Relatorios");
  if (hasPerm(user, PERMISSIONS.BUSCA_GLOBAL)) highlights.push("Busca global");

  return highlights;
}

module.exports = {
  buildAccessHighlights,
  buildPortalQuickLinks,
};
