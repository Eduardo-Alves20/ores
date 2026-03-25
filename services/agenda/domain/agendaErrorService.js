const { ensureValidObjectId } = require("../../shared/objectIdValidationService");

function createAgendaError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

function ensureAgendaObjectId(value, message = "Identificador invalido.") {
  try {
    return ensureValidObjectId(value, message);
  } catch (error) {
    if (error?.status === 400 || error?.code === "INVALID_OBJECT_ID") {
      throw createAgendaError(400, message);
    }
    throw error;
  }
}

module.exports = {
  createAgendaError,
  ensureAgendaObjectId,
};
