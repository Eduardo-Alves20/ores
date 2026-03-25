const mongoose = require("mongoose");
const Familia = require("../../../schemas/social/Familia");
const { Paciente } = require("../../../schemas/social/Paciente");
const { Atendimento } = require("../../../schemas/social/Atendimento");
const Usuario = require("../../../schemas/core/Usuario");
const { PERFIS } = require("../../../config/roles");
const {
  canAccessFamily,
  hasOwnAssistidosScope,
} = require("../../volunteerScopeService");
const { createFamiliaError } = require("./familiaContextService");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");

const FAMILY_ACCESS_ERROR = "Acesso restrito a familias vinculadas ao proprio atendimento.";

async function ensureAccessibleFamily({
  user,
  familiaId,
  select = "_id",
  requireActive = false,
  notFoundMessage = "Familia nao encontrada.",
}) {
  const normalizedFamilyId = ensureValidObjectId(
    familiaId,
    "Identificador de familia invalido."
  );

  if (!(await canAccessFamily(user, normalizedFamilyId))) {
    throw createFamiliaError(FAMILY_ACCESS_ERROR, 403);
  }

  const familia = await Familia.findById(normalizedFamilyId).select(select);
  if (!familia) {
    throw createFamiliaError(notFoundMessage, 404);
  }

  if (requireActive && !familia.ativo) {
    throw createFamiliaError(notFoundMessage, 404);
  }

  return familia;
}

async function ensurePatientBelongsToFamily({ pacienteId, familiaId }) {
  const normalizedPacienteId = ensureValidObjectId(
    pacienteId,
    "Identificador de paciente invalido."
  );
  const normalizedFamiliaId = ensureValidObjectId(
    familiaId,
    "Identificador de familia invalido."
  );

  const paciente = await Paciente.findOne({
    _id: normalizedPacienteId,
    familiaId: normalizedFamiliaId,
  }).select("_id");
  if (!paciente) {
    throw createFamiliaError("Paciente nao pertence a esta familia.", 400);
  }
  return paciente;
}

async function loadAccessiblePatient({ id, user }) {
  const normalizedId = ensureValidObjectId(id, "Identificador de paciente invalido.");
  const paciente = await Paciente.findById(normalizedId).select("_id familiaId");
  if (!paciente) return null;

  if (!(await canAccessFamily(user, paciente.familiaId))) {
    throw createFamiliaError(FAMILY_ACCESS_ERROR, 403);
  }

  return paciente;
}

async function loadAccessibleAttendance({ id, user }) {
  const normalizedId = ensureValidObjectId(
    id,
    "Identificador de atendimento invalido."
  );
  const atendimento = await Atendimento.findById(normalizedId).select(
    "_id familiaId pacienteId profissionalId"
  );
  if (!atendimento) return null;

  if (!(await canAccessFamily(user, atendimento.familiaId))) {
    throw createFamiliaError(FAMILY_ACCESS_ERROR, 403);
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
    throw createFamiliaError(message, 403);
  }
}

module.exports = {
  FAMILY_ACCESS_ERROR,
  ensureAccessibleFamily,
  ensurePatientBelongsToFamily,
  loadAccessibleAttendance,
  loadAccessiblePatient,
  findApprovedVolunteerProfessional,
  ensureOwnScopedProfessional,
  hasOwnAssistidosScope,
};
