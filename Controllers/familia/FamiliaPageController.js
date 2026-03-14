const Familia = require("../../schemas/social/Familia");

function buildViewBase(title) {
  return {
    title,
    layout: "partials/app.ejs",
    sectionTitle: "Assistidos",
    navKey: "assistidos",
    pageClass: "page-assistidos familias-page",
    extraCss: ["/css/familias.css"],
    extraJs: ["/js/familias.js"],
  };
}

class FamiliaPageController {
  static async listar(req, res) {
    return res.status(200).render("pages/familias/lista", {
      ...buildViewBase("Familias"),
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
      ...buildViewBase("Nova Familia"),
      modo: "criar",
      familia: null,
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
      ...buildViewBase("Editar Familia"),
      modo: "editar",
      familia,
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
      ...buildViewBase("Detalhe da Familia"),
      familia,
    });
  }
}

module.exports = FamiliaPageController;


