const { PERMISSIONS } = require("../../../config/permissions");
const { hasAnyPermission } = require("../../shared/accessControlService");

function getSessionUser(req) {
  return req?.session?.user || null;
}

function canViewAll(user) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_VIEW_ALL]);
}

function canAssignOthers(user) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_ASSIGN_OTHERS]);
}

function canManageRooms(user) {
  return canViewAll(user);
}

function canMutateEvent(user, evento) {
  if (canViewAll(user)) return true;
  return String(evento?.responsavelId || "") === String(user?.id || "");
}

function canRegisterAttendance(user, evento) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_ATTENDANCE]) && canMutateEvent(user, evento);
}

module.exports = {
  getSessionUser,
  canViewAll,
  canAssignOthers,
  canManageRooms,
  canMutateEvent,
  canRegisterAttendance,
};
