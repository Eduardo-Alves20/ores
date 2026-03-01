const { PERMISSIONS } = require("../../config/permissions");
const { TIPOS_AGENDA } = require("../../schemas/social/AgendaEvento");
const { hasAnyPermission } = require("../../services/accessControlService");

function buildPermissions(user) {
  const permissionList = user?.permissions || [];
  const canViewAll = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_VIEW_ALL]);
  const canAssignOthers = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_ASSIGN_OTHERS]);
  const canCreate = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_CREATE]);
  const canMove = hasAnyPermission(permissionList, [PERMISSIONS.AGENDA_MOVE]);

  return {
    canViewAll,
    canAssignOthers,
    canCreate,
    canMove,
  };
}

class AgendaPageController {
  static async index(req, res) {
    const user = req?.session?.user || null;

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
      },
    });
  }
}

module.exports = AgendaPageController;


