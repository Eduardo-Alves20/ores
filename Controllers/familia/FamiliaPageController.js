const { PERMISSIONS } = require("../../config/permissions");
const { registrarAuditoria } = require("../../services/shared/auditService");
const { hasAnyPermission } = require("../../services/shared/accessControlService");
const { listCustomFields, listQuickFilters } = require("../../services/shared/systemConfigService");
const { parseBoolean } = require("../../services/shared/valueParsingService");
const {
  changeFamilyStatus,
  createFamily,
  getActorId,
  getSessionUser,
  updateFamily,
} = require("../../services/familia/familiaApiService");
const { ensureAccessibleFamily } = require("../../services/familia/api/familiaGuardService");
const { mapFamilyFormBodyToPayload } = require("../../services/familia/api/familiaInputService");

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
    extraCss: ["/css/familias.css", "/css/acessos.css"],
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
      ...buildViewBase(req, "Assistidos"),
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
      ...buildViewBase(req, "Novo Assistido"),
      modo: "criar",
      familia: null,
      customFields: await listCustomFields("familia", { includeInactive: false }),
    });
  }

  static async criarViaFormulario(req, res) {
    try {
      const payload = mapFamilyFormBodyToPayload(req.body || {});
      const result = await createFamily({
        actorId: getActorId(req),
        body: payload,
      });

      if (result?.audit) {
        await registrarAuditoria(req, result.audit);
      }

      const createdFamilyId = String(result?.familia?._id || "").trim();
      req.flash("success", result?.mensagem || "Assistido cadastrado com sucesso.");
      return res.redirect(createdFamilyId ? `/familias/${createdFamilyId}` : "/familias");
    } catch (error) {
      req.flash("error", error?.message || "Nao foi possivel cadastrar o assistido.");
      return res.redirect("/familias/nova");
    }
  }

  static async editar(req, res) {
    try {
      const familiaDoc = await ensureAccessibleFamily({
        user: req?.session?.user || null,
        familiaId: req.params?.id,
        select: "responsavel endereco observacoes camposExtras anexos ativo createdAt updatedAt",
        notFoundMessage: "Assistido nao encontrado.",
      });
      const familia = familiaDoc?.toObject
        ? familiaDoc.toObject({ flattenMaps: true })
        : familiaDoc;

      return res.status(200).render("pages/familias/form", {
        ...buildViewBase(req, "Editar Assistido"),
        modo: "editar",
        familia,
        customFields: await listCustomFields("familia", { includeInactive: false }),
      });
    } catch (error) {
      if ([400, 403, 404].includes(Number(error?.status || 0))) {
        req.flash("error", "Assistido nao encontrado ou acesso nao permitido.");
        return res.redirect("/familias");
      }
      throw error;
    }
  }

  static async atualizarViaFormulario(req, res) {
    const familyId = String(req.params?.id || "").trim();

    try {
      if (!familyId) {
        req.flash("error", "Assistido nao encontrado.");
        return res.redirect("/familias");
      }

      const payload = mapFamilyFormBodyToPayload(req.body || {});
      const result = await updateFamily({
        id: familyId,
        user: getSessionUser(req),
        actorId: getActorId(req),
        body: payload,
      });

      if (!result?.familia) {
        req.flash("error", "Assistido nao encontrado.");
        return res.redirect("/familias");
      }

      if (result.audit) {
        await registrarAuditoria(req, result.audit);
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, "ativo")) {
        const ativo = parseBoolean(req.body?.ativo);
        if (typeof ativo !== "undefined" && ativo !== result.familia.ativo) {
          const statusResult = await changeFamilyStatus({
            id: familyId,
            user: getSessionUser(req),
            actorId: getActorId(req),
            ativoInput: ativo,
          });
          if (statusResult?.audit) {
            await registrarAuditoria(req, statusResult.audit);
          }
        }
      }

      req.flash("success", result?.mensagem || "Assistido atualizado com sucesso.");
      return res.redirect(`/familias/${familyId}`);
    } catch (error) {
      req.flash("error", error?.message || "Nao foi possivel salvar o assistido.");
      return res.redirect(`/familias/${familyId}/editar`);
    }
  }

  static async detalhar(req, res) {
    try {
      const familiaDoc = await ensureAccessibleFamily({
        user: req?.session?.user || null,
        familiaId: req.params?.id,
        select: "responsavel endereco observacoes camposExtras ativo createdAt updatedAt",
        notFoundMessage: "Assistido nao encontrado.",
      });
      const familia = familiaDoc?.toObject
        ? familiaDoc.toObject({ flattenMaps: true })
        : familiaDoc;

      return res.status(200).render("pages/familias/detalhe", {
        ...buildViewBase(req, "Detalhe do Assistido"),
        familia,
      });
    } catch (error) {
      if ([400, 403, 404].includes(Number(error?.status || 0))) {
        req.flash("error", "Assistido nao encontrado ou acesso nao permitido.");
        return res.redirect("/familias");
      }
      throw error;
    }
  }
}

module.exports = FamiliaPageController;
