const Usuario = require("../../../../schemas/core/Usuario");
const FuncaoAcesso = require("../../../../schemas/core/FuncaoAcesso");
const { PERMISSION_GROUPS } = require("../../../../config/permissions");
const { escapeRegex } = require("../../../shared/searchUtilsService");

function buildSecurityUserFilter(userBusca) {
  if (!userBusca) return {};

  const regex = new RegExp(escapeRegex(userBusca), "i");
  return {
    $or: [{ nome: regex }, { email: regex }, { login: regex }],
  };
}

function resolveEditedRole(roles = [], roleIdEmEdicao = "") {
  return roles.find((item) => String(item?._id || "") === roleIdEmEdicao) || null;
}

async function buildSecurityAccessPageView(query = {}, flash = {}) {
  const roleIdEmEdicao = String(query?.editar || "").trim();
  const userBusca = String(query?.userBusca || "").trim().slice(0, 80);

  const [roles, usuarios] = await Promise.all([
    FuncaoAcesso.find({}).sort({ nome: 1 }).lean(),
    Usuario.find(buildSecurityUserFilter(userBusca))
      .select("_id nome email login perfil ativo funcoesAcesso")
      .populate({
        path: "funcoesAcesso",
        select: "_id nome slug ativo",
        options: { lean: true },
      })
      .sort({ nome: 1 })
      .limit(80)
      .lean(),
  ]);

  return {
    title: "Seguranca de Acesso",
    sectionTitle: "Seguranca de Acesso",
    navKey: "seguranca-funcoes",
    layout: "partials/app.ejs",
    pageClass: "page-seguranca-funcoes",
    extraCss: ["/css/seguranca.css"],
    permissionGroups: PERMISSION_GROUPS,
    roles,
    roleEmEdicao: resolveEditedRole(roles, roleIdEmEdicao),
    usuarios,
    filtros: { userBusca },
    successMessage: flash.success || [],
    errorMessage: flash.error || [],
  };
}

module.exports = {
  buildSecurityAccessPageView,
  buildSecurityUserFilter,
  resolveEditedRole,
};
