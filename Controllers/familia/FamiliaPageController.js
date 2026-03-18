const Familia = require("../../schemas/social/Familia");
const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../../services/accessControlService");
const { listCustomFields, listQuickFilters } = require("../../services/systemConfigService");

function buildViewFlags(req) {
  const permissionList = req?.session?.user?.permissions || [];

  return {
    canCreateFamily: hasAnyPermission(permissionList, [PERMISSIONS.FAMILIAS_CREATE]),
    canEditFamily: hasAnyPermission(permissionList, [PERMISSIONS.FAMILIAS_UPDATE]),
    canToggleFamilyStatus: hasAnyPermission(permissionList, [PERMISSIONS.FAMILIAS_STATUS]),
    canCreatePatient: hasAnyPermission(permissionList, [PERMISSIONS.PACIENTES_CREATE]),
    canEditPatient: hasAnyPermission(permissionList, [PERMISSIONS.PACIENTES_UPDATE]),
    canTogglePatientStatus: hasAnyPermission(permissionList, [PERMISSIONS.PACIENTES_STATUS]),
    canCreateAttendance: hasAnyPermission(permissionList, [PERMISSIONS.ATENDIMENTOS_CREATE]),
    canEditAttendance: hasAnyPermission(permissionList, [PERMISSIONS.ATENDIMENTOS_UPDATE]),
    canToggleAttendanceStatus: hasAnyPermission(permissionList, [PERMISSIONS.ATENDIMENTOS_STATUS]),
  };
}

function buildViewBase(req, title) {
  return {
    title,
    layout: "partials/app.ejs",
    sectionTitle: "Assistidos",
    navKey: "assistidos",
    pageClass: "page-assistidos familias-page",
    extraCss: ["/css/familias.css"],
    extraJs: [
      "/js/familias-shared.js",
      "/js/familias-lista.js",
      "/js/familias-form.js",
      "/js/familias-detalhe-ui.js",
      "/js/familias-detalhe.js",
      "/js/familias.js",
    ],
    viewFlags: buildViewFlags(req),
  };
}

class FamiliaPageController {
  static async listar(req, res) {
    const quickFilters = await listQuickFilters("assistidos_familias", { includeInactive: false });

    return res.status(200).render("pages/familias/lista", {
      ...buildViewBase(req, "Familias"),
      quickFilters,
      filtros: {
        busca: String(req.query.busca || ""),
        ativo: String(req.query.ativo || ""),
        parentesco: String(req.query.parentesco || ""),
        cidade: String(req.query.cidade || ""),
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 10),
      },
    });
  }

  static async novo(req, res) {
    return res.status(200).render("pages/familias/form", {
      ...buildViewBase(req, "Nova Familia"),
      modo: "criar",
      familia: null,
      customFields: await listCustomFields("familia", { includeInactive: false }),
    });
  }

  static async editar(req, res) {
    const { id } = req.params;
    const familia = await Familia.findById(id).lean();
    if (!familia) {
      req.flash("error", "Familia nao encontrada.");
      return res.redirect("/familias");
    }

    return res.status(200).render("pages/familias/form", {
      ...buildViewBase(req, "Editar Familia"),
      modo: "editar",
      familia,
      customFields: await listCustomFields("familia", { includeInactive: false }),
    });
  }

  static async detalhar(req, res) {
    const { id } = req.params;
    const familia = await Familia.findById(id).lean();
    if (!familia) {
      req.flash("error", "Familia nao encontrada.");
      return res.redirect("/familias");
    }

    return res.status(200).render("pages/familias/detalhe", {
      ...buildViewBase(req, "Detalhe da Familia"),
      familia,
    });
  }
}

module.exports = FamiliaPageController;
