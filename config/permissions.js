const { PERFIS } = require("./roles");

const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: "dashboard.view",

  FAMILIAS_VIEW: "familias.view",
  FAMILIAS_CREATE: "familias.create",
  FAMILIAS_UPDATE: "familias.update",
  FAMILIAS_STATUS: "familias.status",

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
  AGENDA_VIEW_ALL: "agenda.view_all",
  AGENDA_ASSIGN_OTHERS: "agenda.assign_others",

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
});

const PERMISSION_GROUPS = Object.freeze([
  {
    key: "assistidos",
    label: "Assistidos",
    permissions: [
      { key: PERMISSIONS.FAMILIAS_VIEW, label: "Visualizar familias" },
      { key: PERMISSIONS.FAMILIAS_CREATE, label: "Criar familias" },
      { key: PERMISSIONS.FAMILIAS_UPDATE, label: "Editar familias" },
      { key: PERMISSIONS.FAMILIAS_STATUS, label: "Ativar/Inativar familias" },
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
      { key: PERMISSIONS.AGENDA_VIEW_ALL, label: "Ver agenda global" },
      { key: PERMISSIONS.AGENDA_ASSIGN_OTHERS, label: "Atribuir responsavel" },
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
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.AGENDA_ASSIGN_OTHERS,
    PERMISSIONS.ACESSOS_VIEW,
    PERMISSIONS.ACESSOS_APPROVE,
    PERMISSIONS.USUARIOS_MANAGE,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.CONTA_EDIT_ALL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [PERFIS.ATENDENTE]: [
    PERMISSIONS.DASHBOARD_VIEW,
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
