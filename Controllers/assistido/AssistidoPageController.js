const { PERMISSIONS } = require("../../config/permissions");
const { hasAnyPermission } = require("../../services/shared/accessControlService");
const { ensureAssistidoAcessivel } = require("../../services/assistido/api/assistidoGuardService");

function buildViewFlags(req) {
  const permissionList = req?.session?.user?.permissions || [];
  return {
    canCreate: hasAnyPermission(permissionList, [PERMISSIONS.ASSISTIDOS_CREATE]),
    canUpdate: hasAnyPermission(permissionList, [PERMISSIONS.ASSISTIDOS_UPDATE]),
    canStatus: hasAnyPermission(permissionList, [PERMISSIONS.ASSISTIDOS_STATUS]),
  };
}

function buildViewBase(req, title) {
  return {
    title,
    layout: "partials/app.ejs",
    sectionTitle: "Assistidos",
    navKey: "assistidos",
    pageClass: "page-assistidos familias-page",
    extraCss: ["/css/familias.css", "/css/acessos.css"],
    extraJs: [
      "/js/familias-shared.js",
      "/js/assistidos-form.js",
    ],
    viewFlags: buildViewFlags(req),
  };
}

class AssistidoPageController {
  static async listar(req, res) {
    const base = buildViewBase(req, "Assistidos");
    return res.status(200).render("pages/assistidos/lista", {
      ...base,
      extraJs: ["/js/familias-shared.js", "/js/assistidos-lista.js"],
      filtros: {
        busca: String(req.query.busca || ""),
        status: String(req.query.status || ""),
        faixaEtaria: String(req.query.faixaEtaria || ""),
        cidade: String(req.query.cidade || ""),
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 10),
      },
    });
  }

  static async novo(req, res) {
    return res.status(200).render("pages/assistidos/form", {
      ...buildViewBase(req, "Novo Assistido"),
      modo: "criar",
      assistido: null,
    });
  }

  static async editar(req, res) {
    try {
      const assistidoDoc = await ensureAssistidoAcessivel({
        user: req?.session?.user || null,
        assistidoId: req.params?.id,
        select: "nome cpf rg orgaoEmissor dataNascimento faixaEtaria sexoBiologico corRaca suporte naturalidade nacionalidade telefonePrincipal telefoneSecundario isWhatsApp email permissaoContato responsavel contatoEmergencia endereco diagnosticoResumo observacoes camposExtras status etapaConcluida anexos ativo createdAt updatedAt",
      });
      const assistido = assistidoDoc?.toObject
        ? assistidoDoc.toObject({ flattenMaps: true })
        : assistidoDoc;

      return res.status(200).render("pages/assistidos/form", {
        ...buildViewBase(req, "Editar Assistido"),
        modo: "editar",
        assistido,
      });
    } catch (error) {
      if ([400, 403, 404].includes(Number(error?.status || 0))) {
        req.flash("error", "Assistido não encontrado ou acesso não permitido.");
        return res.redirect("/assistidos");
      }
      throw error;
    }
  }

  static async detalhar(req, res) {
    try {
      const assistidoDoc = await ensureAssistidoAcessivel({
        user: req?.session?.user || null,
        assistidoId: req.params?.id,
        select: "nome cpf rg dataNascimento sexoBiologico corRaca telefonePrincipal telefoneSecundario email endereco responsavel status etapaConcluida ativo createdAt updatedAt",
      });
      const assistido = assistidoDoc?.toObject
        ? assistidoDoc.toObject({ flattenMaps: true })
        : assistidoDoc;

      return res.status(200).render("pages/assistidos/detalhe", {
        ...buildViewBase(req, "Ficha do Assistido"),
        assistido,
      });
    } catch (error) {
      if ([400, 403, 404].includes(Number(error?.status || 0))) {
        req.flash("error", "Assistido não encontrado ou acesso não permitido.");
        return res.redirect("/assistidos");
      }
      throw error;
    }
  }
}

module.exports = AssistidoPageController;
