function createFamiliaError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getActorId(req) {
  return req?.session?.user?.id || null;
}

function getSessionUser(req) {
  return req?.session?.user || null;
}

module.exports = {
  createFamiliaError,
  getActorId,
  getSessionUser,
};
