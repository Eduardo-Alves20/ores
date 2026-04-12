const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");

function hasPerm(user, permission) {
  return hasAnyPermission(user?.permissions || [], [permission]);
}

function buildPortalQuickLinks(user) {
  const links = [];
  const tipoCadastro = String(user?.tipoCadastro || "").trim().toLowerCase();

  if (hasPerm(user, PERMISSIONS.PORTAL_MEUS_DADOS)) {
    links.push({
      href: "/meus-dados",
      label: "Meus Dados",
      description: "Veja seus dados cadastrais e o tipo de acesso liberado.",
      icon: "fa-address-card",
    });
  }

  if (tipoCadastro === "familia" && hasPerm(user, PERMISSIONS.PORTAL_MINHA_FAMILIA)) {
    links.push({
      href: "/minha-familia",
      label: "Portal da Familia",
      description: "Veja os dados da familia, dependentes e o panorama do acompanhamento.",
      icon: "fa-heart",
    });
    links.push({
      href: "/minha-familia/consultas",
      label: "Consultas",
      description: "Consulte agendamentos futuros, faltas, presencas e remarcacoes.",
      icon: "fa-calendar-days",
    });
    links.push({
      href: "/minha-familia/notificacoes",
      label: "Notificacoes",
      description: "Acompanhe novas consultas, cancelamentos e atualizacoes recentes.",
      icon: "fa-bell",
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

  if (hasPerm(user, PERMISSIONS.FAMILIAS_VIEW)) {
    links.push({
      href: "/familias",
      label: "Assistidos",
      description: "Consulte familias, dependentes e acompanhamentos.",
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
  }

  return links;
}

function buildAccessHighlights(user) {
  const highlights = [];
  const tipoCadastro = String(user?.tipoCadastro || "").trim().toLowerCase();

  if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) highlights.push("Painel executivo");
  if (hasPerm(user, PERMISSIONS.FAMILIAS_VIEW)) highlights.push("Consulta de assistidos");
  if (hasPerm(user, PERMISSIONS.ATENDIMENTOS_CREATE)) highlights.push("Registro de atendimentos");
  if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) highlights.push("Agenda");
  if (hasPerm(user, PERMISSIONS.AGENDA_ATTENDANCE)) highlights.push("Presencas");
  if (hasPerm(user, PERMISSIONS.RELATORIOS_VIEW)) highlights.push("Relatorios");
  if (hasPerm(user, PERMISSIONS.BUSCA_GLOBAL)) highlights.push("Busca global");
  if (tipoCadastro === "familia" && hasPerm(user, PERMISSIONS.PORTAL_MINHA_FAMILIA)) {
    highlights.push("Portal da familia");
    highlights.push("Consultas e notificacoes");
  }

  return highlights;
}

module.exports = {
  buildAccessHighlights,
  buildPortalQuickLinks,
};
