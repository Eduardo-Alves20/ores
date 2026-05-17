const { PERFIS } = require("./roles");

const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: "dashboard.view",

  FAMILIAS_VIEW: "familias.view",
  FAMILIAS_CREATE: "familias.create",
  FAMILIAS_UPDATE: "familias.update",
  FAMILIAS_STATUS: "familias.status",

  ASSISTIDOS_VIEW: "assistidos.view",
  ASSISTIDOS_CREATE: "assistidos.create",
  ASSISTIDOS_UPDATE: "assistidos.update",
  ASSISTIDOS_STATUS: "assistidos.status",

  PACIENTES_VIEW: "pacientes.view",
  PACIENTES_CREATE: "pacientes.create",
  PACIENTES_UPDATE: "pacientes.update",
  PACIENTES_STATUS: "pacientes.status",

  ATENDIMENTOS_VIEW: "atendimentos.view",
  ATENDIMENTOS_CREATE: "atendimentos.create",
  ATENDIMENTOS_UPDATE: "atendimentos.update",
  ATENDIMENTOS_STATUS: "atendimentos.status",
  ASSISTIDOS_SCOPE_OWN: "assistidos.scope_own",

  AGENDA_VIEW: "agenda.view",
  AGENDA_CREATE: "agenda.create",
  AGENDA_UPDATE: "agenda.update",
  AGENDA_MOVE: "agenda.move",
  AGENDA_STATUS: "agenda.status",
  AGENDA_ATTENDANCE: "agenda.attendance",
  AGENDA_VIEW_ALL: "agenda.view_all",
  AGENDA_ASSIGN_OTHERS: "agenda.assign_others",
  AGENDA_MEDICO_MANAGE: "agenda.medico.manage",

  ACESSOS_VIEW: "acessos.view",
  ACESSOS_APPROVE: "acessos.approve",

  USUARIOS_MANAGE: "usuarios.manage",
  RELATORIOS_VIEW: "relatorios.view",
  BUSCA_GLOBAL: "busca.global",

  CONTA_EDIT_ALL: "conta.edit_all",
  NOTIFICACOES_VIEW: "notificacoes.view",

  PORTAL_MEUS_DADOS: "portal.meus_dados",
  PORTAL_MINHA_FAMILIA: "portal.minha_familia",

  SEGURANCA_FUNCOES_MANAGE: "seguranca.funcoes.manage",
  SEGURANCA_FUNCOES_ASSIGN: "seguranca.funcoes.assign",

  ASSISTIDOS_CREATE_SOCIAL: "assistidos.create.social",
  ENTREVISTA_SOCIAL_CREATE: "entrevista_social.create",
  ENTREVISTA_SOCIAL_READ_OWN: "entrevista_social.read_own",
  RELATORIO_TRIAGEM_CREATE: "relatorio_triagem.create",
  RELATORIO_TRIAGEM_READ_OWN: "relatorio_triagem.read_own",
  ANAMNESE_CREATE_UPDATE: "anamnese.create_update",
  ANAMNESE_READ_CARE_TEAM: "anamnese.read_care_team",
  RELATORIO_INDIVIDUAL_CREATE_UPDATE: "relatorio_individual.create_update",
  RELATORIO_INDIVIDUAL_READ_SCOPED: "relatorio_individual.read_scoped",
  RELATORIO_EVOLUCAO_CREATE_UPDATE: "relatorio_evolucao.create_update",
  RELATORIO_EVOLUCAO_READ_SCOPED: "relatorio_evolucao.read_scoped",
  RELATORIO_GERAL_READ_CARE_TEAM: "relatorio_geral.read_care_team",
});

const PERMISSION_GROUPS = Object.freeze([
  {
    key: "assistidos",
    label: "Assistidos",
    permissions: [
      { key: PERMISSIONS.ASSISTIDOS_VIEW, label: "Visualizar assistidos" },
      { key: PERMISSIONS.ASSISTIDOS_CREATE, label: "Criar assistidos" },
      { key: PERMISSIONS.ASSISTIDOS_UPDATE, label: "Editar assistidos" },
      { key: PERMISSIONS.ASSISTIDOS_STATUS, label: "Ativar/Inativar assistidos" },
      { key: PERMISSIONS.FAMILIAS_VIEW, label: "Visualizar familias (legado)" },
      { key: PERMISSIONS.FAMILIAS_CREATE, label: "Criar familias (legado)" },
      { key: PERMISSIONS.FAMILIAS_UPDATE, label: "Editar familias (legado)" },
      { key: PERMISSIONS.FAMILIAS_STATUS, label: "Ativar/Inativar familias (legado)" },
      { key: PERMISSIONS.PACIENTES_VIEW, label: "Visualizar dependentes" },
      { key: PERMISSIONS.PACIENTES_CREATE, label: "Criar dependentes" },
      { key: PERMISSIONS.PACIENTES_UPDATE, label: "Editar dependentes" },
      { key: PERMISSIONS.PACIENTES_STATUS, label: "Ativar/Inativar dependentes" },
      { key: PERMISSIONS.ATENDIMENTOS_VIEW, label: "Visualizar atendimentos" },
      { key: PERMISSIONS.ATENDIMENTOS_CREATE, label: "Criar atendimentos" },
      { key: PERMISSIONS.ATENDIMENTOS_UPDATE, label: "Editar atendimentos" },
      { key: PERMISSIONS.ATENDIMENTOS_STATUS, label: "Ativar/Inativar atendimentos" },
      { key: PERMISSIONS.ASSISTIDOS_SCOPE_OWN, label: "Restringir assistidos ao proprio atendimento" },
    ],
  },
  {
    key: "agenda",
    label: "Agenda",
    permissions: [
      { key: PERMISSIONS.AGENDA_VIEW, label: "Visualizar agenda" },
      { key: PERMISSIONS.AGENDA_CREATE, label: "Criar agendamentos" },
      { key: PERMISSIONS.AGENDA_UPDATE, label: "Editar agendamentos" },
      { key: PERMISSIONS.AGENDA_MOVE, label: "Mover agendamentos" },
      { key: PERMISSIONS.AGENDA_STATUS, label: "Ativar/Inativar agendamentos" },
      { key: PERMISSIONS.AGENDA_ATTENDANCE, label: "Registrar presenca e faltas" },
      { key: PERMISSIONS.AGENDA_VIEW_ALL, label: "Ver agenda global" },
      { key: PERMISSIONS.AGENDA_ASSIGN_OTHERS, label: "Atribuir responsavel" },
      { key: PERMISSIONS.AGENDA_MEDICO_MANAGE, label: "Gerenciar agendamento medico" },
    ],
  },
  {
    key: "atendimento_clinico",
    label: "Atendimento Clinico",
    permissions: [
      { key: PERMISSIONS.ASSISTIDOS_CREATE_SOCIAL, label: "Cadastrar assistidos via triagem social" },
      { key: PERMISSIONS.ENTREVISTA_SOCIAL_CREATE, label: "Criar entrevista social" },
      { key: PERMISSIONS.ENTREVISTA_SOCIAL_READ_OWN, label: "Ler entrevista social propria" },
      { key: PERMISSIONS.RELATORIO_TRIAGEM_CREATE, label: "Criar relatorio de triagem" },
      { key: PERMISSIONS.RELATORIO_TRIAGEM_READ_OWN, label: "Ler relatorio de triagem proprio" },
      { key: PERMISSIONS.ANAMNESE_CREATE_UPDATE, label: "Criar/editar anamnese" },
      { key: PERMISSIONS.ANAMNESE_READ_CARE_TEAM, label: "Ler anamnese da rede de cuidado" },
      { key: PERMISSIONS.RELATORIO_INDIVIDUAL_CREATE_UPDATE, label: "Criar/editar relatorio individual" },
      { key: PERMISSIONS.RELATORIO_INDIVIDUAL_READ_SCOPED, label: "Ler relatorio individual com escopo" },
      { key: PERMISSIONS.RELATORIO_EVOLUCAO_CREATE_UPDATE, label: "Criar/editar relatorio de evolucao" },
      { key: PERMISSIONS.RELATORIO_EVOLUCAO_READ_SCOPED, label: "Ler relatorio de evolucao com escopo" },
      { key: PERMISSIONS.RELATORIO_GERAL_READ_CARE_TEAM, label: "Ler relatorio geral da rede de cuidado" },
    ],
  },
  {
    key: "acesso",
    label: "Acessos e Usuarios",
    permissions: [
      { key: PERMISSIONS.ACESSOS_VIEW, label: "Visualizar acessos" },
      { key: PERMISSIONS.ACESSOS_APPROVE, label: "Aprovar/Rejeitar acessos" },
      { key: PERMISSIONS.USUARIOS_MANAGE, label: "Gerenciar usuarios (API)" },
      { key: PERMISSIONS.CONTA_EDIT_ALL, label: "Editar perfil com campos de admin" },
    ],
  },
  {
    key: "sistema",
    label: "Sistema",
    permissions: [
      { key: PERMISSIONS.DASHBOARD_VIEW, label: "Visualizar dashboard" },
      { key: PERMISSIONS.RELATORIOS_VIEW, label: "Visualizar relatorios" },
      { key: PERMISSIONS.BUSCA_GLOBAL, label: "Usar busca global" },
      { key: PERMISSIONS.NOTIFICACOES_VIEW, label: "Visualizar notificacoes" },
    ],
  },
  {
    key: "portal",
    label: "Portal Usuario",
    permissions: [
      { key: PERMISSIONS.PORTAL_MEUS_DADOS, label: "Portal: Meus Dados" },
      { key: PERMISSIONS.PORTAL_MINHA_FAMILIA, label: "Portal: Minha Familia" },
    ],
  },
  {
    key: "seguranca",
    label: "Seguranca (SuperAdmin)",
    permissions: [
      { key: PERMISSIONS.SEGURANCA_FUNCOES_MANAGE, label: "Gerenciar funcoes e permissoes" },
      { key: PERMISSIONS.SEGURANCA_FUNCOES_ASSIGN, label: "Atribuir funcoes para usuarios" },
    ],
  },
]);

const ALL_PERMISSION_KEYS = Object.freeze(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((item) => item.key))
);

const DEFAULT_PERMISSIONS_BY_PROFILE = Object.freeze({
  [PERFIS.SUPERADMIN]: ["*"],
  [PERFIS.ADMIN]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ASSISTIDOS_VIEW,
    PERMISSIONS.ASSISTIDOS_CREATE,
    PERMISSIONS.ASSISTIDOS_UPDATE,
    PERMISSIONS.ASSISTIDOS_STATUS,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.FAMILIAS_CREATE,
    PERMISSIONS.FAMILIAS_UPDATE,
    PERMISSIONS.FAMILIAS_STATUS,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.PACIENTES_CREATE,
    PERMISSIONS.PACIENTES_UPDATE,
    PERMISSIONS.PACIENTES_STATUS,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.ATENDIMENTOS_STATUS,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_CREATE,
    PERMISSIONS.AGENDA_UPDATE,
    PERMISSIONS.AGENDA_MOVE,
    PERMISSIONS.AGENDA_STATUS,
    PERMISSIONS.AGENDA_ATTENDANCE,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.AGENDA_ASSIGN_OTHERS,
    PERMISSIONS.AGENDA_MEDICO_MANAGE,
    PERMISSIONS.ACESSOS_VIEW,
    PERMISSIONS.ACESSOS_APPROVE,
    PERMISSIONS.USUARIOS_MANAGE,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.CONTA_EDIT_ALL,
    PERMISSIONS.NOTIFICACOES_VIEW,
    PERMISSIONS.ASSISTIDOS_CREATE_SOCIAL,
    PERMISSIONS.ENTREVISTA_SOCIAL_READ_OWN,
    PERMISSIONS.RELATORIO_TRIAGEM_CREATE,
    PERMISSIONS.RELATORIO_TRIAGEM_READ_OWN,
    PERMISSIONS.ANAMNESE_CREATE_UPDATE,
    PERMISSIONS.ANAMNESE_READ_CARE_TEAM,
    PERMISSIONS.RELATORIO_INDIVIDUAL_CREATE_UPDATE,
    PERMISSIONS.RELATORIO_INDIVIDUAL_READ_SCOPED,
    PERMISSIONS.RELATORIO_EVOLUCAO_READ_SCOPED,
    PERMISSIONS.RELATORIO_GERAL_READ_CARE_TEAM,
  ],
  [PERFIS.ASSISTENTE_SOCIAL]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ASSISTIDOS_VIEW,
    PERMISSIONS.ASSISTIDOS_CREATE,
    PERMISSIONS.ASSISTIDOS_UPDATE,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.FAMILIAS_CREATE,
    PERMISSIONS.FAMILIAS_UPDATE,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.PACIENTES_CREATE,
    PERMISSIONS.PACIENTES_UPDATE,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.ASSISTIDOS_CREATE_SOCIAL,
    PERMISSIONS.ENTREVISTA_SOCIAL_CREATE,
    PERMISSIONS.ENTREVISTA_SOCIAL_READ_OWN,
    PERMISSIONS.RELATORIO_TRIAGEM_CREATE,
    PERMISSIONS.RELATORIO_TRIAGEM_READ_OWN,
    PERMISSIONS.ANAMNESE_READ_CARE_TEAM,
    PERMISSIONS.RELATORIO_GERAL_READ_CARE_TEAM,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [PERFIS.PROFISSIONAL]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.ANAMNESE_CREATE_UPDATE,
    PERMISSIONS.ANAMNESE_READ_CARE_TEAM,
    PERMISSIONS.RELATORIO_INDIVIDUAL_CREATE_UPDATE,
    PERMISSIONS.RELATORIO_INDIVIDUAL_READ_SCOPED,
    PERMISSIONS.RELATORIO_EVOLUCAO_CREATE_UPDATE,
    PERMISSIONS.RELATORIO_EVOLUCAO_READ_SCOPED,
    PERMISSIONS.RELATORIO_GERAL_READ_CARE_TEAM,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [PERFIS.AGENDADOR_MEDICO]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.AGENDA_ASSIGN_OTHERS,
    PERMISSIONS.AGENDA_MEDICO_MANAGE,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [PERFIS.ATENDENTE]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ASSISTIDOS_VIEW,
    PERMISSIONS.ASSISTIDOS_CREATE,
    PERMISSIONS.ASSISTIDOS_UPDATE,
    PERMISSIONS.ASSISTIDOS_STATUS,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.FAMILIAS_CREATE,
    PERMISSIONS.FAMILIAS_UPDATE,
    PERMISSIONS.FAMILIAS_STATUS,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.PACIENTES_CREATE,
    PERMISSIONS.PACIENTES_UPDATE,
    PERMISSIONS.PACIENTES_STATUS,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.ATENDIMENTOS_STATUS,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_CREATE,
    PERMISSIONS.AGENDA_UPDATE,
    PERMISSIONS.AGENDA_MOVE,
    PERMISSIONS.AGENDA_STATUS,
    PERMISSIONS.AGENDA_ATTENDANCE,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.AGENDA_ASSIGN_OTHERS,
    PERMISSIONS.ACESSOS_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [PERFIS.TECNICO]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.ATENDIMENTOS_STATUS,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_CREATE,
    PERMISSIONS.AGENDA_UPDATE,
    PERMISSIONS.AGENDA_MOVE,
    PERMISSIONS.AGENDA_STATUS,
    PERMISSIONS.AGENDA_ATTENDANCE,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [PERFIS.USUARIO]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.PORTAL_MINHA_FAMILIA,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
});

function normalizePermissionList(inputList) {
  const set = new Set();
  const list = Array.isArray(inputList) ? inputList : [inputList];

  list.forEach((item) => {
    const key = String(item || "").trim();
    if (!key) return;
    if (key === "*") {
      set.add("*");
      return;
    }
    if (ALL_PERMISSION_KEYS.includes(key)) {
      set.add(key);
    }
  });

  return Array.from(set.values());
}

function getDefaultPermissionsForProfile(perfil) {
  const key = String(perfil || "").trim().toLowerCase();
  return normalizePermissionList(DEFAULT_PERMISSIONS_BY_PROFILE[key] || []);
}

module.exports = {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  DEFAULT_PERMISSIONS_BY_PROFILE,
  normalizePermissionList,
  getDefaultPermissionsForProfile,
};
 