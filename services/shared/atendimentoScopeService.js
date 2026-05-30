const mongoose = require("mongoose");
const { Atendimento } = require("../../schemas/social/Atendimento");
const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const { canAccessAssistido, hasOwnAssistidosScope } = require("./volunteerScopeService");
const { ensureValidObjectId } = require("./objectIdValidationService");

const ASSISTIDO_ACCESS_ERROR = "Acesso restrito a assistidos vinculados ao proprio atendimento.";

function createScopeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function loadAccessibleAttendance({ id, user }) {
  const normalizedId = ensureValidObjectId(id, "Identificador de atendimento invalido.");
  const atendimento = await Atendimento.findById(normalizedId).select(
    "_id assistidoId profissionalId criadoPor ownerId careTeamIds visibilityScope registroTipo"
  );
  if (!atendimento) return null;

  if (!(await canAccessAssistido(user, atendimento.assistidoId))) {
    throw createScopeError(ASSISTIDO_ACCESS_ERROR, 403);
  }

  return atendimento;
}

async function findApprovedVolunteerProfessional(profissionalId) {
  const raw = String(profissionalId || "").trim();
  if (!raw) return null;
  if (!mongoose.isValidObjectId(raw)) return null;

  return Usuario.findOne({
    _id: raw,
    tipoCadastro: "voluntario",
    perfil: PERFIS.USUARIO,
    statusAprovacao: "aprovado",
    ativo: true,
  }).select("_id nome login email");
}

function ensureOwnScopedProfessional(user, actorId, profissionalId, message) {
  const normalizedProfessionalId = profissionalId
    ? ensureValidObjectId(profissionalId, "Identificador de profissional invalido.")
    : "";

  if (
    hasOwnAssistidosScope(user) &&
    normalizedProfessionalId &&
    String(normalizedProfessionalId) !== String(actorId)
  ) {
    throw createScopeError(message, 403);
  }
}

module.exports = {
  ASSISTIDO_ACCESS_ERROR,
  loadAccessibleAttendance,
  findApprovedVolunteerProfessional,
  ensureOwnScopedProfessional,
  hasOwnAssistidosScope,
};
