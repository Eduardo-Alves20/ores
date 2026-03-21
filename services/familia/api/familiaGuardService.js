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

const FAMILY_ACCESS_ERROR = "Acesso restrito a familias vinculadas ao proprio atendimento.";

async function ensureAccessibleFamily({
  user,
  familiaId,
  select = "_id",
  requireActive = false,
  notFoundMessage = "Familia nao encontrada.",
}) {
  if (!(await canAccessFamily(user, familiaId))) {
    throw createFamiliaError(FAMILY_ACCESS_ERROR, 403);
  }

  const familia = await Familia.findById(familiaId).select(select);
  if (!familia) {
    throw createFamiliaError(notFoundMessage, 404);
  }

  if (requireActive && !familia.ativo) {
    throw createFamiliaError(notFoundMessage, 404);
  }

  return familia;
}

async function ensurePatientBelongsToFamily({ pacienteId, familiaId }) {
  const paciente = await Paciente.findOne({ _id: pacienteId, familiaId }).select("_id");
  if (!paciente) {
    throw createFamiliaError("Paciente nao pertence a esta familia.", 400);
  }
  return paciente;
}

async function loadAccessiblePatient({ id, user }) {
  const paciente = await Paciente.findById(id).select("_id familiaId");
  if (!paciente) return null;

  if (!(await canAccessFamily(user, paciente.familiaId))) {
    throw createFamiliaError(FAMILY_ACCESS_ERROR, 403);
  }

  return paciente;
}

async function loadAccessibleAttendance({ id, user }) {
  const atendimento = await Atendimento.findById(id).select(
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
  if (
    hasOwnAssistidosScope(user) &&
    profissionalId &&
    String(profissionalId) !== String(actorId)
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
