const {
  PERMISSIONS,
  normalizePermissionList,
} = require("./permissions");

const VOLUNTARIO_ACCESS_LEVELS = Object.freeze({
  VOLUNTARIO_ATENDIMENTO: "voluntario_atendimento",
  SERVICO_SOCIAL: "servico_social",
  CAPTACAO: "captacao",
  DIRETORIA: "diretoria",
});

const VOLUNTARIO_ACCESS_OPTIONS = Object.freeze([
  {
    value: VOLUNTARIO_ACCESS_LEVELS.VOLUNTARIO_ATENDIMENTO,
    label: "Voluntario de Atendimento",
    description: "Ve somente os assistidos vinculados ao proprio atendimento e registra informacoes sem deletar.",
  },
  {
    value: VOLUNTARIO_ACCESS_LEVELS.SERVICO_SOCIAL,
    label: "Servico Social",
    description: "Consulta ampla das fichas dos assistidos e pode registrar acompanhamentos sem excluir dados.",
  },
  {
    value: VOLUNTARIO_ACCESS_LEVELS.CAPTACAO,
    label: "Captacao de Recursos",
    description: "Acompanha editais, projetos e demandas institucionais sem atendimento direto.",
  },
  {
    value: VOLUNTARIO_ACCESS_LEVELS.DIRETORIA,
    label: "Diretoria",
    description: "Acesso amplo de gestao para presidencia e tesouraria, sem administrar acessos do sistema.",
  },
]);

const PERMISSIONS_BY_VOLUNTARIO_LEVEL = Object.freeze({
  [VOLUNTARIO_ACCESS_LEVELS.VOLUNTARIO_ATENDIMENTO]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_ATTENDANCE,
    PERMISSIONS.NOTIFICACOES_VIEW,
    PERMISSIONS.ASSISTIDOS_SCOPE_OWN,
  ],
  [VOLUNTARIO_ACCESS_LEVELS.SERVICO_SOCIAL]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [VOLUNTARIO_ACCESS_LEVELS.CAPTACAO]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  [VOLUNTARIO_ACCESS_LEVELS.DIRETORIA]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.FAMILIAS_CREATE,
    PERMISSIONS.FAMILIAS_UPDATE,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.PACIENTES_CREATE,
    PERMISSIONS.PACIENTES_UPDATE,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.ATENDIMENTOS_CREATE,
    PERMISSIONS.ATENDIMENTOS_UPDATE,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_CREATE,
    PERMISSIONS.AGENDA_UPDATE,
    PERMISSIONS.AGENDA_MOVE,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.AGENDA_ASSIGN_OTHERS,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
});

function normalizeVolunteerAccessLevel(value, fallback = null) {
  const raw = String(value || "").trim().toLowerCase();
  const validValues = new Set(Object.values(VOLUNTARIO_ACCESS_LEVELS));
  if (validValues.has(raw)) return raw;
  return fallback;
}

function getVolunteerAccessLabel(value) {
  const normalized = normalizeVolunteerAccessLevel(value);
  const found = VOLUNTARIO_ACCESS_OPTIONS.find((option) => option.value === normalized);
  return found ? found.label : "";
}

function getPermissionsForVolunteerAccessLevel(value) {
  const normalized = normalizeVolunteerAccessLevel(value);
  return normalizePermissionList(PERMISSIONS_BY_VOLUNTARIO_LEVEL[normalized] || []);
}

module.exports = {
  VOLUNTARIO_ACCESS_LEVELS,
  VOLUNTARIO_ACCESS_OPTIONS,
  PERMISSIONS_BY_VOLUNTARIO_LEVEL,
  normalizeVolunteerAccessLevel,
  getVolunteerAccessLabel,
  getPermissionsForVolunteerAccessLevel,
};
