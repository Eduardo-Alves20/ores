const { Assistido } = require("../../../schemas/social/Assistido");
const { createAssistidoError } = require("./assistidoContextService");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");

async function ensureAssistidoAcessivel({
  user,
  assistidoId,
  select = "_id",
  requireActive = false,
  notFoundMessage = "Assistido não encontrado.",
}) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  const assistido = await Assistido.findById(id).select(select);

  if (!assistido) throw createAssistidoError(notFoundMessage, 404);
  if (requireActive && !assistido.ativo) throw createAssistidoError(notFoundMessage, 404);

  return assistido;
}

module.exports = { ensureAssistidoAcessivel };
