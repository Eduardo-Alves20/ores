const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Familia = require("../../../schemas/social/Familia");
const { normalizeCustomFieldValues } = require("../../shared/systemConfigService");
const { parseBoolean } = require("../../shared/valueParsingService");
const { createFamiliaError } = require("./familiaContextService");
const { ensureAccessibleFamily } = require("./familiaGuardService");
const {
  isValidCep,
  isValidCpf,
  isValidPhone,
  isIsoDate,
  isPlainObject,
  normalizeFamilyAddress,
  normalizeFamilyObservacoes,
  normalizeFamilyResponsible,
} = require("./familiaInputService");

const FAMILY_ATTACHMENT_FIELDS = Object.freeze({
  anexo_documentacao: { fieldName: "anexo_documentacao", categoria: "documentacao" },
  anexo_residencia: { fieldName: "anexo_residencia", categoria: "residencia" },
  anexo_renda: { fieldName: "anexo_renda", categoria: "renda" },
  anexo_saude: { fieldName: "anexo_saude", categoria: "saude" },
  anexo_foto: { fieldName: "anexo_foto", categoria: "foto" },
  anexo_outros: { fieldName: "anexo_outros", categoria: "outros" },
});

const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ATTACHMENT_ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"]);
const DEFAULT_FAMILY_UPLOAD_ROOT = path.join(process.cwd(), "storage", "familia-anexos");
const MAX_FAMILY_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_FAMILY_ATTACHMENT_FILES = 30;

function sanitizeFileName(value) {
  const normalized = String(value || "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return normalized || "arquivo";
}

function normalizeAttachmentExtension(fileName) {
  return path.extname(String(fileName || "").trim()).replace(/^\./, "").toLowerCase();
}

function resolveFamilyUploadRoot() {
  return path.resolve(String(process.env.FAMILY_UPLOADS_DIR || DEFAULT_FAMILY_UPLOAD_ROOT));
}

function ensureFamilyStoragePath(storageKey) {
  const root = resolveFamilyUploadRoot();
  const relativeKey = String(storageKey || "").trim();
  if (!relativeKey) {
    throw createFamiliaError("Caminho do anexo ausente.", 500);
  }

  const normalizedRelativePath = path.normalize(relativeKey);
  if (
    path.isAbsolute(normalizedRelativePath) ||
    normalizedRelativePath.startsWith("..") ||
    normalizedRelativePath.includes(`..${path.sep}`)
  ) {
    throw createFamiliaError("Caminho do anexo invalido.", 500);
  }

  const absolutePath = path.resolve(root, normalizedRelativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw createFamiliaError("Caminho do anexo fora da area permitida.", 500);
  }

  return absolutePath;
}

function detectAttachmentMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";

  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["heif", "mif1", "msf1"].includes(brand)) return "image/heif";
  }

  return "";
}

function normalizeFieldDefinition(fieldName) {
  const key = String(fieldName || "").trim();
  return FAMILY_ATTACHMENT_FIELDS[key] || FAMILY_ATTACHMENT_FIELDS.anexo_outros;
}

function validateFamilyAttachmentFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw createFamiliaError("Envie um arquivo valido.", 400);
  }

  if (file.buffer.length > MAX_FAMILY_ATTACHMENT_BYTES) {
    throw createFamiliaError("O arquivo excede o limite de 10MB.", 400);
  }

  const extension = normalizeAttachmentExtension(file.originalname);
  if (!ATTACHMENT_ALLOWED_EXTENSIONS.has(extension)) {
    throw createFamiliaError("Extensao de arquivo nao permitida para anexos.", 400);
  }

  const detectedMimeType = detectAttachmentMimeType(file.buffer);
  if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(detectedMimeType)) {
    throw createFamiliaError("Formato de anexo nao permitido. Use PDF, JPG, PNG, WEBP ou HEIC.", 400);
  }

  const declaredMimeType = String(file.mimetype || "").trim().toLowerCase();
  const compatibleMismatch =
    !declaredMimeType ||
    declaredMimeType === "application/octet-stream" ||
    (declaredMimeType === "image/jpg" && detectedMimeType === "image/jpeg");

  if (declaredMimeType && declaredMimeType !== detectedMimeType && !compatibleMismatch) {
    throw createFamiliaError("O tipo do arquivo nao confere com o conteudo enviado.", 400);
  }

  return {
    extension,
    mimeType: detectedMimeType,
  };
}

function buildFamilyAttachmentStorageKey(familiaId, extension) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const fileName = `${crypto.randomUUID()}.${extension}`;
  return path.join(String(familiaId), String(now.getUTCFullYear()), month, day, fileName);
}

async function saveFamilyAttachmentFile({ familiaId, file }) {
  const validated = validateFamilyAttachmentFile(file);
  const storageKey = buildFamilyAttachmentStorageKey(familiaId, validated.extension);
  const absolutePath = ensureFamilyStoragePath(storageKey);

  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    storageKey,
    extension: validated.extension,
    mimeType: validated.mimeType,
  };
}

async function createFamily({ actorId, body = {} }) {
  const responsavel = normalizeFamilyResponsible(body?.responsavel);
  const endereco = normalizeFamilyAddress(body?.endereco);
  const observacoes = normalizeFamilyObservacoes(body?.observacoes);
  const camposExtras = body?.camposExtras || {};
  const nome = responsavel.nome;
  const telefone = responsavel.telefone;

  if (!nome || !telefone) {
    throw createFamiliaError("Campos obrigatorios do responsavel: nome e telefone.", 400);
  }
  if (!isValidPhone(telefone)) {
    throw createFamiliaError("Telefone principal invalido. Informe DDD + numero.", 400);
  }
  if (responsavel.cpfResponsavel && !isValidCpf(responsavel.cpfResponsavel)) {
    throw createFamiliaError("CPF do responsavel invalido.", 400);
  }
  if (responsavel.telefoneResponsavel && !isValidPhone(responsavel.telefoneResponsavel)) {
    throw createFamiliaError("Telefone do responsavel invalido.", 400);
  }
  if (responsavel.dataNascimentoResponsavel && !isIsoDate(responsavel.dataNascimentoResponsavel)) {
    throw createFamiliaError("Data de nascimento do responsavel invalida.", 400);
  }
  if (endereco?.cep && !isValidCep(endereco.cep)) {
    throw createFamiliaError("CEP invalido.", 400);
  }

  const normalizedCamposExtras = await normalizeCustomFieldValues("familia", camposExtras);
  const familia = await Familia.create({
    responsavel: {
      nome,
      telefone,
      email: responsavel.email || undefined,
      parentesco: responsavel.parentesco || "responsavel",
      nomeResponsavel: responsavel.nomeResponsavel || undefined,
      cpfResponsavel: responsavel.cpfResponsavel || undefined,
      dataNascimentoResponsavel: responsavel.dataNascimentoResponsavel || undefined,
      telefoneResponsavel: responsavel.telefoneResponsavel || undefined,
      emailResponsavel: responsavel.emailResponsavel || undefined,
    },
    endereco,
    observacoes,
    camposExtras: normalizedCamposExtras,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  return {
    mensagem: "Familia cadastrada com sucesso.",
    familia,
    audit: {
      acao: "FAMILIA_CRIADA",
      entidade: "familia",
      entidadeId: familia._id,
    },
  };
}

async function updateFamily({ id, user, actorId, body = {} }) {
  await ensureAccessibleFamily({
    user,
    familiaId: id,
    select: "_id",
    notFoundMessage: "Familia nao encontrada.",
  });

  const { responsavel, endereco, observacoes, camposExtras } = body;
  const patch = {
    atualizadoPor: actorId,
  };

  if (isPlainObject(responsavel)) {
    const normalizedResponsavel = normalizeFamilyResponsible(responsavel);

    if (Object.prototype.hasOwnProperty.call(responsavel, "nome")) {
      if (!normalizedResponsavel.nome) {
        throw createFamiliaError("Campo nome do responsavel e obrigatorio.", 400);
      }
      patch["responsavel.nome"] = normalizedResponsavel.nome;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "telefone")) {
      if (!normalizedResponsavel.telefone) {
        throw createFamiliaError("Campo telefone do responsavel e obrigatorio.", 400);
      }
      if (!isValidPhone(normalizedResponsavel.telefone)) {
        throw createFamiliaError("Telefone principal invalido. Informe DDD + numero.", 400);
      }
      patch["responsavel.telefone"] = normalizedResponsavel.telefone;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "email")) {
      patch["responsavel.email"] = normalizedResponsavel.email;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "parentesco")) {
      patch["responsavel.parentesco"] = normalizedResponsavel.parentesco;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "nomeResponsavel")) {
      patch["responsavel.nomeResponsavel"] = normalizedResponsavel.nomeResponsavel;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "cpfResponsavel")) {
      if (normalizedResponsavel.cpfResponsavel && !isValidCpf(normalizedResponsavel.cpfResponsavel)) {
        throw createFamiliaError("CPF do responsavel invalido.", 400);
      }
      patch["responsavel.cpfResponsavel"] = normalizedResponsavel.cpfResponsavel;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "dataNascimentoResponsavel")) {
      if (
        normalizedResponsavel.dataNascimentoResponsavel &&
        !isIsoDate(normalizedResponsavel.dataNascimentoResponsavel)
      ) {
        throw createFamiliaError("Data de nascimento do responsavel invalida.", 400);
      }
      patch["responsavel.dataNascimentoResponsavel"] = normalizedResponsavel.dataNascimentoResponsavel;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "telefoneResponsavel")) {
      if (
        normalizedResponsavel.telefoneResponsavel &&
        !isValidPhone(normalizedResponsavel.telefoneResponsavel)
      ) {
        throw createFamiliaError("Telefone do responsavel invalido.", 400);
      }
      patch["responsavel.telefoneResponsavel"] = normalizedResponsavel.telefoneResponsavel;
    }
    if (Object.prototype.hasOwnProperty.call(responsavel, "emailResponsavel")) {
      patch["responsavel.emailResponsavel"] = normalizedResponsavel.emailResponsavel;
    }
  }

  if (typeof observacoes !== "undefined") {
    patch.observacoes = normalizeFamilyObservacoes(observacoes);
  }
  if (typeof endereco !== "undefined") {
    const normalizedAddress = normalizeFamilyAddress(endereco);
    if (normalizedAddress?.cep && !isValidCep(normalizedAddress.cep)) {
      throw createFamiliaError("CEP invalido.", 400);
    }
    patch.endereco = normalizedAddress;
  }
  if (typeof camposExtras !== "undefined") {
    patch.camposExtras = await normalizeCustomFieldValues("familia", camposExtras || {});
  }

  const familia = await Familia.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  if (!familia) {
    return null;
  }

  return {
    mensagem: "Familia atualizada com sucesso.",
    familia,
    audit: {
      acao: "FAMILIA_ATUALIZADA",
      entidade: "familia",
      entidadeId: id,
    },
  };
}

async function uploadFamilyAttachments({ id, user, actorId, files = [] }) {
  await ensureAccessibleFamily({
    user,
    familiaId: id,
    select: "_id",
    notFoundMessage: "Familia nao encontrada.",
  });

  const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!normalizedFiles.length) {
    throw createFamiliaError("Nenhum anexo enviado.", 400);
  }
  if (normalizedFiles.length > MAX_FAMILY_ATTACHMENT_FILES) {
    throw createFamiliaError("Quantidade de anexos acima do limite permitido.", 400);
  }

  const createdAttachments = [];
  for (const file of normalizedFiles) {
    const field = normalizeFieldDefinition(file.fieldname);
    const stored = await saveFamilyAttachmentFile({ familiaId: id, file });
    createdAttachments.push({
      attachmentId: crypto.randomUUID(),
      fieldName: field.fieldName,
      categoria: field.categoria,
      originalName: sanitizeFileName(file.originalname),
      mimeType: stored.mimeType,
      extension: stored.extension,
      size: Number(file.size || file.buffer.length || 0),
      storageKey: stored.storageKey,
      uploadedAt: new Date(),
      uploadedBy: actorId || null,
    });
  }

  const familia = await Familia.findByIdAndUpdate(
    id,
    {
      $push: { anexos: { $each: createdAttachments } },
      atualizadoPor: actorId,
    },
    { new: true, runValidators: true }
  );

  if (!familia) return null;

  return {
    mensagem: "Anexos enviados com sucesso.",
    familia,
    anexos: createdAttachments,
    total: createdAttachments.length,
    audit: {
      acao: "FAMILIA_ANEXOS_ENVIADOS",
      entidade: "familia",
      entidadeId: id,
      detalhes: { totalAnexos: createdAttachments.length },
    },
  };
}

async function openFamilyAttachment({ id, attachmentId, user }) {
  const familia = await ensureAccessibleFamily({
    user,
    familiaId: id,
    select: "_id anexos",
    notFoundMessage: "Familia nao encontrada.",
  });

  const normalizedAttachmentId = String(attachmentId || "").trim();
  if (!normalizedAttachmentId) {
    throw createFamiliaError("Identificador do anexo invalido.", 400);
  }

  const attachment = (familia?.anexos || []).find(
    (item) => String(item?.attachmentId || "") === normalizedAttachmentId
  );
  if (!attachment?.storageKey) {
    throw createFamiliaError("Anexo nao encontrado.", 404);
  }

  const absolutePath = ensureFamilyStoragePath(attachment.storageKey);
  let buffer;
  try {
    buffer = await fs.promises.readFile(absolutePath);
  } catch (_) {
    throw createFamiliaError("Arquivo do anexo nao encontrado.", 404);
  }

  return {
    attachment,
    buffer,
  };
}

async function changeFamilyStatus({ id, user, actorId, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createFamiliaError("Campo ativo e obrigatorio.", 400);
  }

  await ensureAccessibleFamily({
    user,
    familiaId: id,
    select: "_id",
    notFoundMessage: "Familia nao encontrada.",
  });

  const patch = {
    ativo,
    atualizadoPor: actorId,
    inativadoEm: ativo ? null : new Date(),
    inativadoPor: ativo ? null : actorId,
  };

  const familia = await Familia.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });

  if (!familia) {
    return null;
  }

  return {
    mensagem: "Status da familia atualizado com sucesso.",
    familia,
    audit: {
      acao: ativo ? "FAMILIA_REATIVADA" : "FAMILIA_INATIVADA",
      entidade: "familia",
      entidadeId: id,
    },
  };
}

module.exports = {
  changeFamilyStatus,
  createFamily,
  openFamilyAttachment,
  uploadFamilyAttachments,
  updateFamily,
};
