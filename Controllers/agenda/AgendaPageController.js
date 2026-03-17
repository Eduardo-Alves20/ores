const { PERMISSIONS } = require("../../config/permissions");
const {
  TIPOS_AGENDA,
  AGENDA_ROOM_REQUIRED_TYPES,
  AGENDA_DEFAULT_DURATION_MINUTES,
} = require("../../schemas/social/AgendaEvento");
const { hasAnyPermission } = require("../../services/accessControlService");
const { listPresenceReasons } = require("../../services/systemConfigService");

function buildPermissions(user) {
  const permissionList = user?.permissions || [];
  const canViewAll = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const canAssignOthers = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_ASSIGN_OTHERS]);
  const canCreate = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_CREATE]);
  const canMove = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_MOVE]);
  const canRegisterAttendance = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_ATTENDANCE]);
  const canManageRooms = canViewAll;

  return {
    canViewAll,
    canAssignOthers,
    canCreate,
    canMove,
    canRegisterAttendance,
    canManageRooms,
  };
}

class AgendaPageController {
  static async index(req, res) {
    const user = req?.session?.user || null;
    const attendanceJustifications = await listPresenceReasons({ includeInactive: false });

    return res.status(200).render("pages/agenda/index", {
      title: "Agenda",
      sectionTitle: "Agenda",
      navKey: "agenda",
      layout: "partials/app.ejs",
      pageClass: "page-agenda agenda-page",
      extraCss: ["/css/agenda.css"],
      extraJs: ["/js/agenda.js"],
      agendaConfig: {
        user: {
          id: user?.id || null,
          nome: user?.nome || "",
          perfil: user?.perfil || "",
        },
        permissions: buildPermissions(user),
        tiposAtendimento: TIPOS_AGENDA,
        roomRequiredTypes: AGENDA_ROOM_REQUIRED_TYPES,
        slotMinutes: AGENDA_DEFAULT_DURATION_MINUTES,
        attendanceJustifications,
      },
    });
  }
}

module.exports = AgendaPageController;
