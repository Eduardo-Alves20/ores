const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const { ensureValidObjectId } = require("../shared/objectIdValidationService");

const AUTH_SENSITIVE_FIELDS = Object.freeze([
  "ativo",
  "cpf",
  "email",
  "funcoesAcesso",
  "login",
  "nivelAcessoVoluntario",
  "papelAprovacao",
  "perfil",
  "statusAprovacao",
  "tipoCadastro",
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeAuthVersion(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function buildSessionUserPayload(usuario, permissions = []) {
  if (!usuario) return null;

  return {
    id: String(usuario._id || usuario.id || ""),
    nome: normalizeString(usuario.nome),
    email: normalizeLower(usuario.email),
    perfil: normalizeLower(usuario.perfil),
    tipoCadastro: normalizeLower(usuario.tipoCadastro),
    nivelAcessoVoluntario: normalizeLower(usuario.nivelAcessoVoluntario),
    authVersion: normalizeAuthVersion(usuario.authVersion),
    permissions: Array.isArray(permissions) ? permissions : [],
  };
}

function shouldBumpAuthVersion(dados = {}) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return false;
  }

  return AUTH_SENSITIVE_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(dados, field)
  );
}

function buildAuthVersionUpdate(dados = {}) {
  if (!shouldBumpAuthVersion(dados)) {
    return {};
  }

  return {
    $inc: {
      authVersion: 1,
    },
  };
}

function ensureValidSessionUserId(userId) {
  try {
    return ensureValidObjectId(userId, "Identificador de usuario invalido.");
  } catch (_) {
    return null;
  }
}

async function loadSessionValidationSnapshot(userId) {
  const normalizedUserId = ensureValidSessionUserId(userId);
  if (!normalizedUserId) return null;

  return Usuario.findById(normalizedUserId)
    .select(
      "_id nome email perfil tipoCadastro nivelAcessoVoluntario ativo statusAprovacao authVersion"
    )
    .lean();
}

function resolveSessionInvalidationReason(sessionUser, snapshot) {
  if (!sessionUser?.id) return "SESSION_USER_INVALID";
  if (!snapshot) return "USER_NOT_FOUND";
  if (!snapshot.ativo) return "ACCOUNT_INACTIVE";

  const snapshotPerfil = normalizeLower(snapshot.perfil);
  const snapshotStatusAprovacao = normalizeLower(snapshot.statusAprovacao);

  if (snapshotPerfil === PERFIS.USUARIO && snapshotStatusAprovacao !== "aprovado") {
    return "APPROVAL_REVOKED";
  }

  if (
    normalizeAuthVersion(sessionUser.authVersion) !==
    normalizeAuthVersion(snapshot.authVersion)
  ) {
    return "AUTH_VERSION_MISMATCH";
  }

  if (normalizeLower(sessionUser.perfil) !== snapshotPerfil) {
    return "PROFILE_CHANGED";
  }

  if (normalizeLower(sessionUser.tipoCadastro) !== normalizeLower(snapshot.tipoCadastro)) {
    return "USER_TYPE_CHANGED";
  }

  if (
    normalizeLower(sessionUser.nivelAcessoVoluntario) !==
    normalizeLower(snapshot.nivelAcessoVoluntario)
  ) {
    return "ACCESS_LEVEL_CHANGED";
  }

  return "";
}

module.exports = {
  AUTH_SENSITIVE_FIELDS,
  buildAuthVersionUpdate,
  buildSessionUserPayload,
  loadSessionValidationSnapshot,
  normalizeAuthVersion,
  resolveSessionInvalidationReason,
  shouldBumpAuthVersion,
};
