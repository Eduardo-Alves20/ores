const { PERFIS } = require("../config/roles");
const { TIPOS_AGENDA } = require("../schemas/AgendaEvento");

function buildPermissions(user) {
  const perfil = user?.perfil || "";
  const canViewAll = perfil === PERFIS.ADMIN || perfil === PERFIS.ATENDENTE;
  const canAssignOthers = canViewAll;
  const canCreate = perfil === PERFIS.ADMIN || perfil === PERFIS.ATENDENTE || perfil === PERFIS.TECNICO;
  const canMove = canCreate;

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

