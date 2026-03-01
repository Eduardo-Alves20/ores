const Usuario = require("../schemas/core/Usuario");
const { PERFIS } = require("../config/roles");
const {
  getDefaultPermissionsForProfile,
  normalizePermissionList,
} = require("../config/permissions");

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
    .select("perfil funcoesAcesso ativo")
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
    return getDefaultPermissionsForProfile(fallbackPerfil);
  }

  const perfil = String(user.perfil || fallbackPerfil || "").toLowerCase();
  if (perfil === PERFIS.SUPERADMIN) return ["*"];

  const funcoesAtivas = Array.isArray(user.funcoesAcesso)
    ? user.funcoesAcesso.filter((funcao) => funcao && funcao.ativo !== false)
    : [];

  if (funcoesAtivas.length) {
    return mapPermissoesDeFuncoes(funcoesAtivas);
  }

  return getDefaultPermissionsForProfile(perfil);
}

async function resolvePermissionsFromSession(req) {
  const sessionUser = req?.session?.user || null;
  if (!sessionUser) return [];

  if (Array.isArray(sessionUser.permissions) && sessionUser.permissions.length) {
    return normalizePermissionList(sessionUser.permissions);
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

