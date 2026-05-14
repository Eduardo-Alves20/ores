const {
  PERMISSIONS,
  normalizePermissionList,
} = require("./permissions");

const VOLUNTARIO_ACCESS_LEVELS = Object.freeze({
  // Valores persistidos (mantidos por compatibilidade com base legada)
  VOLUNTARIO_ATENDIMENTO: "voluntario_atendimento",
  SERVICO_SOCIAL: "servico_social",
  CAPTACAO: "captacao",
  DIRETORIA: "diretoria",
  // Aliases semanticos alinhados a matriz v2
  PROFISSIONAL_MEDICO: "voluntario_atendimento",
  ASSISTENTE_SOCIAL: "servico_social",
  AGENDADOR_MEDICO: "captacao",
});

const VOLUNTARIO_ACCESS_OPTIONS = Object.freeze([
  {
    value: VOLUNTARIO_ACCESS_LEVELS.PROFISSIONAL_MEDICO,
    label: "Profissional / Medico",
    description: "Atendimento clinico com escopo restrito a propria rede de cuidado.",
  },
  {
    value: VOLUNTARIO_ACCESS_LEVELS.ASSISTENTE_SOCIAL,
    label: "Assistente Social",
    description: "Triagem social completa: cadastro de assistidos, entrevista social, relatorio inicial e acompanhamento.",
  },
  {
    value: VOLUNTARIO_ACCESS_LEVELS.AGENDADOR_MEDICO,
    label: "Agendador Medico",
    description: "Gerencia agenda medica e operacoes de marcacao, remarcacao e cancelamento.",
  },
]);

const PERMISSIONS_BY_VOLUNTARIO_LEVEL = Object.freeze({
  [VOLUNTARIO_ACCESS_LEVELS.PROFISSIONAL_MEDICO]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
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
    PERMISSIONS.ASSISTIDOS_SCOPE_OWN,
  ],
  [VOLUNTARIO_ACCESS_LEVELS.ASSISTENTE_SOCIAL]: [
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
  [VOLUNTARIO_ACCESS_LEVELS.AGENDADOR_MEDICO]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.AGENDA_ASSIGN_OTHERS,
    PERMISSIONS.AGENDA_MEDICO_MANAGE,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
  // Mantido para contas antigas ainda com esse valor.
  [VOLUNTARIO_ACCESS_LEVELS.DIRETORIA]: [
    PERMISSIONS.PORTAL_MEUS_DADOS,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.FAMILIAS_VIEW,
    PERMISSIONS.PACIENTES_VIEW,
    PERMISSIONS.ATENDIMENTOS_VIEW,
    PERMISSIONS.AGENDA_VIEW,
    PERMISSIONS.AGENDA_VIEW_ALL,
    PERMISSIONS.RELATORIOS_VIEW,
    PERMISSIONS.BUSCA_GLOBAL,
    PERMISSIONS.NOTIFICACOES_VIEW,
  ],
});

const LEGACY_VOLUNTARIO_ACCESS_LABELS = Object.freeze({
  [VOLUNTARIO_ACCESS_LEVELS.DIRETORIA]: "Diretoria",
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
  if (found) return found.label;
  if (LEGACY_VOLUNTARIO_ACCESS_LABELS[normalized]) {
    return LEGACY_VOLUNTARIO_ACCESS_LABELS[normalized];
  }
  return "";
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
