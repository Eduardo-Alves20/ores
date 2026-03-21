const {
  PERFIS,
  isAdminProfile,
} = require("../../../config/roles");
const { PERMISSIONS } = require("../../../config/permissions");
const {
  APPROVAL_ROLES,
  getApprovalRoleLabel,
} = require("../../../config/approvalRoles");
const { hasAnyPermission } = require("../../accessControlService");

function isAdmin(req) {
  const user = req?.session?.user || {};
  if (isAdminProfile(user.perfil)) return true;
  return hasAnyPermission(user.permissions || [], [PERMISSIONS.ACESSOS_APPROVE]);
}

function canManageUsers(req) {
  const user = req?.session?.user || {};
  const perfil = String(user.perfil || "").toLowerCase();
  if (perfil === PERFIS.SUPERADMIN) return true;
  return hasAnyPermission(user.permissions || [], [PERMISSIONS.USUARIOS_MANAGE]);
}

function isSuperAdminRequest(req) {
  return String(req?.session?.user?.perfil || "").toLowerCase() === PERFIS.SUPERADMIN;
}

function canManageTargetUser(req, usuario) {
  const perfilAlvo = String(usuario?.perfil || "").toLowerCase();
  if (perfilAlvo !== PERFIS.SUPERADMIN) return true;
  return isSuperAdminRequest(req);
}

function buildCreateProfileOptions(req) {
  const user = req?.session?.user || {};
  const perfilAtual = String(user.perfil || "").toLowerCase();
  const options = [
    { value: PERFIS.USUARIO, label: "Usuario do Portal" },
    { value: PERFIS.ATENDENTE, label: "Atendente" },
    { value: PERFIS.TECNICO, label: "Tecnico" },
    { value: PERFIS.ADMIN, label: "admin_alento" },
  ];

  if (perfilAtual === PERFIS.SUPERADMIN) {
    options.push({ value: PERFIS.SUPERADMIN, label: "SuperAdmin" });
  }

  return options;
}

function buildApprovalRoleOptions() {
  return [
    { value: APPROVAL_ROLES.MEMBRO, label: getApprovalRoleLabel(APPROVAL_ROLES.MEMBRO) },
    { value: APPROVAL_ROLES.PRESIDENTE, label: getApprovalRoleLabel(APPROVAL_ROLES.PRESIDENTE) },
  ];
}

module.exports = {
  isAdmin,
  canManageUsers,
  isSuperAdminRequest,
  canManageTargetUser,
  buildCreateProfileOptions,
  buildApprovalRoleOptions,
};
