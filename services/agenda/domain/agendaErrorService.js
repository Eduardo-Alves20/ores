function createAgendaError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

module.exports = {
  createAgendaError,
};
