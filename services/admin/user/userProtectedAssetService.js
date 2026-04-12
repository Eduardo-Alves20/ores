const {
  consumePendingUpload,
  createSecureAssetError,
  deleteProtectedAsset,
  normalizeStoredProtectedAsset,
  promotePendingProtectedAsset,
} = require("../../security/secureVolunteerAssetService");

function normalizeCurrentAttachmentBundle(bundle = {}) {
  return {
    documentoIdentidade: normalizeStoredProtectedAsset(
      bundle?.documentoIdentidade,
      "documentoIdentidade"
    ),
    fotoPerfil: normalizeStoredProtectedAsset(bundle?.fotoPerfil, "fotoPerfil"),
  };
}

function extractAttachmentInput(body = {}) {
  const source =
    body?.anexosProtegidos && typeof body.anexosProtegidos === "object" && !Array.isArray(body.anexosProtegidos)
      ? body.anexosProtegidos
      : {};

  return {
    documentoIdentidadeToken: String(source.documentoIdentidadeToken || "").trim(),
    fotoPerfilToken: String(source.fotoPerfilToken || "").trim(),
  };
}

function hasAttachmentTokens(body = {}) {
  const input = extractAttachmentInput(body);
  return !!(input.documentoIdentidadeToken || input.fotoPerfilToken);
}

async function resolveProtectedAttachmentsForUser({
  session,
  body = {},
  userId,
  actorId = null,
  currentAttachments = {},
}) {
  const tokens = extractAttachmentInput(body);
  const current = normalizeCurrentAttachmentBundle(currentAttachments);
  const next = { ...current };
  const newAssets = [];
  const replacedAssets = [];
  const fieldDefinitions = [
    {
      field: "documentoIdentidade",
      expectedKind: "documentoIdentidade",
      token: tokens.documentoIdentidadeToken,
    },
    {
      field: "fotoPerfil",
      expectedKind: "fotoPerfil",
      token: tokens.fotoPerfilToken,
    },
  ];

  for (const item of fieldDefinitions) {
    if (!item.token) continue;

    const pendingAsset = consumePendingUpload(session, item.token, item.expectedKind);
    if (!pendingAsset) {
      throw createSecureAssetError(
        `O upload protegido de ${item.field === "fotoPerfil" ? "foto de perfil" : "documento"} expirou ou nao foi encontrado. Envie novamente o arquivo.`,
        400,
        "SECURE_ASSET_UPLOAD_EXPIRED"
      );
    }

    const promotedAsset = await promotePendingProtectedAsset(pendingAsset, {
      userId,
      actorId,
    });

    next[item.field] = promotedAsset;
    newAssets.push(promotedAsset);

    if (current[item.field]) {
      replacedAssets.push(current[item.field]);
    }
  }

  return {
    anexosProtegidos: next,
    newAssets,
    replacedAssets,
  };
}

async function deleteProtectedAssets(assets = []) {
  for (const asset of Array.isArray(assets) ? assets : []) {
    // Segue em frente mesmo se um arquivo ja tiver sido removido.
    await deleteProtectedAsset(asset).catch(() => {});
  }
}

module.exports = {
  deleteProtectedAssets,
  extractAttachmentInput,
  hasAttachmentTokens,
  normalizeCurrentAttachmentBundle,
  resolveProtectedAttachmentsForUser,
};
