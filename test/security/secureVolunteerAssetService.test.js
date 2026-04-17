const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  consumePendingUpload,
  deleteProtectedAsset,
  promotePendingProtectedAsset,
  readProtectedAssetBuffer,
  registerPendingUpload,
} = require("../../services/security/secureVolunteerAssetService");

const USER_ID = "507f191e810c19729de860ea";
const ACTOR_ID = "507f1f77bcf86cd799439011";

test("secureVolunteerAssetService criptografa o arquivo em disco e recupera o conteudo correto", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ORES-secure-asset-"));
  const previousRoot = process.env.SECURE_UPLOADS_DIR;
  const previousKey = process.env.SECURE_FILE_ENCRYPTION_KEY;
  process.env.SECURE_UPLOADS_DIR = tempDir;
  process.env.SECURE_FILE_ENCRYPTION_KEY = "teste-chave-anexos-protegidos";

  const fileBuffer = Buffer.from("%PDF-1.7\nRG do voluntario\n", "utf8");
  const session = {};

  try {
    const uploaded = await registerPendingUpload({
      session,
      kind: "documentoIdentidade",
      file: {
        buffer: fileBuffer,
        originalname: "rg-voluntario.pdf",
        mimetype: "application/pdf",
      },
      actorId: ACTOR_ID,
    });

    assert.ok(uploaded.token);
    assert.equal(uploaded.asset?.kind, "documentoIdentidade");
    assert.equal(uploaded.asset?.mimeType, "application/pdf");

    const pendingAsset = consumePendingUpload(session, uploaded.token, "documentoIdentidade");
    assert.ok(pendingAsset);

    const promotedAsset = await promotePendingProtectedAsset(pendingAsset, {
      userId: USER_ID,
      actorId: ACTOR_ID,
    });

    const encryptedOnDisk = fs.readFileSync(path.join(tempDir, promotedAsset.storageKey));
    assert.notDeepEqual(encryptedOnDisk, fileBuffer);

    const restored = await readProtectedAssetBuffer(promotedAsset);
    assert.deepEqual(restored.buffer, fileBuffer);
    assert.equal(restored.asset.ownerId, USER_ID);

    await deleteProtectedAsset(promotedAsset);
    assert.equal(fs.existsSync(path.join(tempDir, promotedAsset.storageKey)), false);
  } finally {
    if (typeof previousRoot === "undefined") {
      delete process.env.SECURE_UPLOADS_DIR;
    } else {
      process.env.SECURE_UPLOADS_DIR = previousRoot;
    }

    if (typeof previousKey === "undefined") {
      delete process.env.SECURE_FILE_ENCRYPTION_KEY;
    } else {
      process.env.SECURE_FILE_ENCRYPTION_KEY = previousKey;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("secureVolunteerAssetService rejeita extensao nao permitida mesmo quando o campo espera documento", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ORES-secure-asset-invalid-"));
  const previousRoot = process.env.SECURE_UPLOADS_DIR;
  const previousKey = process.env.SECURE_FILE_ENCRYPTION_KEY;
  process.env.SECURE_UPLOADS_DIR = tempDir;
  process.env.SECURE_FILE_ENCRYPTION_KEY = "teste-chave-anexos-protegidos";

  try {
    await assert.rejects(
      () =>
        registerPendingUpload({
          session: {},
          kind: "documentoIdentidade",
          file: {
            buffer: Buffer.from("%PDF-1.7\nconteudo\n", "utf8"),
            originalname: "arquivo.exe",
            mimetype: "application/pdf",
          },
          actorId: ACTOR_ID,
        }),
      (error) =>
        error?.status === 400 &&
        error?.code === "SECURE_ASSET_INVALID_EXTENSION"
    );
  } finally {
    if (typeof previousRoot === "undefined") {
      delete process.env.SECURE_UPLOADS_DIR;
    } else {
      process.env.SECURE_UPLOADS_DIR = previousRoot;
    }

    if (typeof previousKey === "undefined") {
      delete process.env.SECURE_FILE_ENCRYPTION_KEY;
    } else {
      process.env.SECURE_FILE_ENCRYPTION_KEY = previousKey;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
