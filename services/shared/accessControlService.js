const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const {
  PERMISSIONS,
  getDefaultPermissionsForProfile,
  normalizePermissionList,
} = require("../../config/permissions");
const { getPermissionsForVolunteerAccessLevel } = require("../../config/volunteerAccess");

function normalizeList(list) {
  const input = Array.isArray(list) ? list : [list];
  return Array.from(
    new Set(
      input
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

const PROFILE_PERMISSION_MATRIX = Object.freeze({
  [PERFIS.ADMIN]: Object.freeze({
    add: [],
    remove: [
      PERMISSIONS.ENTREVISTA_SOCIAL_CREATE,
      PERMISSIONS.RELATORIO_EVOLUCAO_CREATE_UPDATE,
    ],
  }),
  [PERFIS.PROFISSIONAL]: Object.freeze({
    add: [PERMISSIONS.FAMILIAS_VIEW, PERMISSIONS.PACIENTES_VIEW],
    remove: [],
  }),
});

function applyProfilePermissionMatrix(perfil, permissionList = []) {
  const normalizedProfile = String(perfil || "").trim().toLowerCase();
  const matrix = PROFILE_PERMISSION_MATRIX[normalizedProfile];
  const normalizedPermissions = normalizePermissionList(permissionList);

  if (!matrix || normalizedPermissions.includes("*")) {
    return normalizedPermissions;
  }

  const set = new Set(normalizedPermissions);
  (Array.isArray(matrix.remove) ? matrix.remove : []).forEach((permission) => {
    set.delete(permission);
  });
  (Array.isArray(matrix.add) ? matrix.add : []).forEach((permission) => {
    set.add(permission);
  });

  return normalizePermissionList(Array.from(set.values()));
}

function hasPermission(permissionList, requiredPermission) {
  const required = String(requiredPermission || "").trim();
  if (!required) return true;

  const list = normalizeList(permissionList);
  if (list.includes("*")) return true;
  if (list.includes(required)) return true;

  const [prefix] = required.split(".");
  if (prefix && list.includes(`${prefix}.*`)) return true;

  return false;
}

function hasAnyPermission(permissionList, requiredPermissions = []) {
  const requiredList = normalizeList(requiredPermissions);
  if (!requiredList.length) return true;
  return requiredList.some((permission) => hasPermission(permissionList, permission));
}

function mapPermissoesDeFuncoes(funcoes = []) {
  const lista = [];
  funcoes.forEach((funcao) => {
    if (!funcao || funcao.ativo === false) return;
    const permissoes = Array.isArray(funcao.permissoes) ? funcao.permissoes : [];
    lista.push(...permissoes);
  });
  return normalizePermissionList(lista);
}

async function carregarUsuarioComFuncoes(userId) {
  if (!userId) return null;

  return Usuario.findById(userId)
    .select("perfil tipoCadastro nivelAcessoVoluntario funcoesAcesso ativo")
    .populate({
      path: "funcoesAcesso",
      select: "permissoes ativo",
      options: { lean: true },
    })
    .lean();
}

async function resolvePermissionsForUserId(userId, fallbackPerfil = "") {
  const user = await carregarUsuarioComFuncoes(userId);
  if (!user) {
    return applyProfilePermissionMatrix(
      fallbackPerfil,
      getDefaultPermissionsForProfile(fallbackPerfil)
    );
  }

  const perfil = String(user.perfil || fallbackPerfil || "").toLowerCase();
  if (perfil === PERFIS.SUPERADMIN) return ["*"];

  const funcoesAtivas = Array.isArray(user.funcoesAcesso)
    ? user.funcoesAcesso.filter((funcao) => funcao && funcao.ativo !== false)
    : [];

  if (funcoesAtivas.length) {
    return mapPermissoesDeFuncoes(funcoesAtivas);
  }

  if (perfil === PERFIS.USUARIO) {
    const tipoCadastro = String(user.tipoCadastro || "").toLowerCase();

    if (tipoCadastro === "voluntario") {
      if (user.nivelAcessoVoluntario) {
        return getPermissionsForVolunteerAccessLevel(user.nivelAcessoVoluntario);
      }

      return normalizePermissionList([
        PERMISSIONS.PORTAL_MEUS_DADOS,
        PERMISSIONS.NOTIFICACOES_VIEW,
      ]);
    }

    if (tipoCadastro === "familia") {
      return normalizePermissionList([
        PERMISSIONS.PORTAL_MEUS_DADOS,
        PERMISSIONS.PORTAL_MINHA_FAMILIA,
        PERMISSIONS.NOTIFICACOES_VIEW,
      ]);
    }

    return normalizePermissionList([
      PERMISSIONS.PORTAL_MEUS_DADOS,
      PERMISSIONS.NOTIFICACOES_VIEW,
    ]);
  }

  return applyProfilePermissionMatrix(perfil, getDefaultPermissionsForProfile(perfil));
}

async function resolvePermissionsFromSession(req) {
  const sessionUser = req?.session?.user || null;
  if (!sessionUser) return [];

  const shouldRefreshUsuarioPermissions =
    String(sessionUser.perfil || "").toLowerCase() === PERFIS.USUARIO;

  if (
    Array.isArray(sessionUser.permissions) &&
    sessionUser.permissions.length &&
    !shouldRefreshUsuarioPermissions
  ) {
    const adjusted = applyProfilePermissionMatrix(
      sessionUser.perfil,
      normalizePermissionList(sessionUser.permissions)
    );
    req.session.user.permissions = adjusted;
    return adjusted;
  }

  const resolved = await resolvePermissionsForUserId(sessionUser.id, sessionUser.perfil);
  if (req?.session?.user) {
    req.session.user.permissions = resolved;
  }
  return resolved;
}

async function refreshSessionPermissions(req, userId) {
  const sessionUser = req?.session?.user || null;
  if (!sessionUser) return [];

  if (String(sessionUser.id || "") !== String(userId || "")) return normalizePermissionList(sessionUser.permissions || []);

  const resolved = await resolvePermissionsForUserId(sessionUser.id, sessionUser.perfil);
  req.session.user.permissions = resolved;
  return resolved;
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  resolvePermissionsForUserId,
  resolvePermissionsFromSession,
  refreshSessionPermissions,
};

