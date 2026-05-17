const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Assistido } = require("../../../schemas/social/Assistido");
const { createAssistidoError } = require("./assistidoContextService");
const { ensureAssistidoAcessivel } = require("./assistidoGuardService");
const { normalizeDadosPessoais, normalizeEndereco } = require("./assistidoInputService");
const { parseBoolean } = require("../../shared/valueParsingService");

// ── Anexos ─────────────────────────────────────────────────────────────────

const ATTACHMENT_FIELDS = Object.freeze({
  anexo_documentacao: "documentacao",
  anexo_residencia: "residencia",
  anexo_renda: "renda",
  anexo_saude: "saude",
  anexo_foto: "foto",
  anexo_outros: "outros",
});

const ATTACHMENT_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ATTACHMENT_ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"]);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 30;
const DEFAULT_UPLOAD_ROOT = path.join(process.cwd(), "storage", "assistido-anexos");

function resolveUploadRoot() {
  return path.resolve(String(process.env.ASSISTIDO_UPLOADS_DIR || DEFAULT_UPLOAD_ROOT));
}

function sanitizeFileName(value) {
  return String(value || "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "arquivo";
}

function getExtension(fileName) {
  return path.extname(String(fileName || "")).replace(/^\./, "").toLowerCase();
}

function resolveStoragePath(storageKey) {
  const root = resolveUploadRoot();
  const rel = path.normalize(String(storageKey || "").trim());
  if (path.isAbsolute(rel) || rel.startsWith("..")) {
    throw createAssistidoError("Caminho de anexo inválido.", 500);
  }
  return path.join(root, rel);
}

// ── Criar rascunho ─────────────────────────────────────────────────────────

async function criarAssistido({ actorId }) {
  const assistido = await Assistido.create({
    nome: "Rascunho",
    status: "rascunho",
    etapaConcluida: 0,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  return {
    mensagem: "Rascunho de cadastro criado.",
    assistido,
    audit: {
      acao: "ASSISTIDO_RASCUNHO_CRIADO",
      entidade: "assistido",
      entidadeId: assistido._id,
    },
  };
}

// ── Etapa 1: dados pessoais ────────────────────────────────────────────────

async function salvarDadosPessoais({ actorId, assistidoId, body = {} }) {
  const assistido = await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id ativo",
    requireActive: false,
  });

  const dados = normalizeDadosPessoais(body);

  // Ao salvar etapa 1, avança para pelo menos etapa 1
  const etapaConcluida = Math.max(1, assistido.etapaConcluida || 0);
  const status = assistido.status === "rascunho" ? "em_analise" : assistido.status;

  const atualizado = await Assistido.findByIdAndUpdate(
    assistido._id,
    { ...dados, etapaConcluida, status, atualizadoPor: actorId },
    { new: true, runValidators: true }
  );

  return {
    mensagem: "Dados pessoais salvos.",
    assistido: atualizado,
    audit: {
      acao: "ASSISTIDO_DADOS_PESSOAIS_SALVO",
      entidade: "assistido",
      entidadeId: assistido._id,
    },
  };
}

// ── Etapa 2: endereço ──────────────────────────────────────────────────────

async function salvarEndereco({ actorId, assistidoId, body = {} }) {
  const assistido = await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id etapaConcluida",
    requireActive: false,
  });

  const endereco = normalizeEndereco(body);
  const etapaConcluida = Math.max(2, assistido.etapaConcluida || 0);

  const atualizado = await Assistido.findByIdAndUpdate(
    assistido._id,
    { endereco, etapaConcluida, atualizadoPor: actorId },
    { new: true, runValidators: true }
  );

  return {
    mensagem: "Endereço salvo.",
    assistido: atualizado,
    audit: {
      acao: "ASSISTIDO_ENDERECO_SALVO",
      entidade: "assistido",
      entidadeId: assistido._id,
    },
  };
}

// ── Confirmar cadastro (etapa final) ───────────────────────────────────────

async function confirmarCadastro({ actorId, assistidoId }) {
  const assistido = await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id etapaConcluida nome",
    requireActive: false,
  });

  if (assistido.nome === "Rascunho") {
    throw createAssistidoError("Preencha os dados pessoais antes de confirmar.", 400);
  }

  const atualizado = await Assistido.findByIdAndUpdate(
    assistido._id,
    { status: "ativo", etapaConcluida: 5, atualizadoPor: actorId },
    { new: true, runValidators: true }
  );

  return {
    mensagem: "Cadastro confirmado com sucesso.",
    assistido: atualizado,
    audit: {
      acao: "ASSISTIDO_CADASTRO_CONFIRMADO",
      entidade: "assistido",
      entidadeId: assistido._id,
    },
  };
}

// ── Alterar status (ativar/inativar) ───────────────────────────────────────

async function alterarStatusAssistido({ actorId, assistidoId, ativoInput }) {
  const ativo = parseBoolean(ativoInput);
  if (typeof ativo === "undefined") {
    throw createAssistidoError("Campo ativo é obrigatório.", 400);
  }

  const assistido = await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id ativo",
    requireActive: false,
  });

  const atualizado = await Assistido.findByIdAndUpdate(
    assistido._id,
    {
      ativo,
      atualizadoPor: actorId,
      inativadoEm: ativo ? null : new Date(),
      inativadoPor: ativo ? null : actorId,
    },
    { new: true, runValidators: true }
  );

  return {
    mensagem: `Assistido ${ativo ? "reativado" : "inativado"} com sucesso.`,
    assistido: atualizado,
    audit: {
      acao: ativo ? "ASSISTIDO_REATIVADO" : "ASSISTIDO_INATIVADO",
      entidade: "assistido",
      entidadeId: assistido._id,
    },
  };
}

// ── Upload de anexos (etapa 5) ─────────────────────────────────────────────

async function uploadAnexosAssistido({ actorId, assistidoId, files = [] }) {
  const assistido = await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id ativo anexos etapaConcluida",
    requireActive: false,
  });

  if (!files.length) {
    throw createAssistidoError("Nenhum arquivo recebido.", 400);
  }

  if (assistido.anexos.length + files.length > MAX_ATTACHMENT_FILES) {
    throw createAssistidoError(
      `Limite de ${MAX_ATTACHMENT_FILES} anexos por assistido atingido.`,
      400
    );
  }

  const root = resolveUploadRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

  const novosAnexos = [];

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw createAssistidoError(
        `Arquivo "${file.originalname}" excede o limite de 10MB.`,
        400
      );
    }

    const ext = getExtension(file.originalname);
    if (!ATTACHMENT_ALLOWED_EXT.has(ext) || !ATTACHMENT_ALLOWED_MIME.has(file.mimetype)) {
      throw createAssistidoError(
        `Formato não permitido: "${file.originalname}".`,
        400
      );
    }

    const categoria = ATTACHMENT_FIELDS[file.fieldname] || "outros";
    const attachmentId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.originalname);
    const storageKey = path.join(String(assistido._id), `${attachmentId}-${safeName}`);
    const fullPath = resolveStoragePath(storageKey);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.buffer);

    novosAnexos.push({
      attachmentId,
      fieldName: file.fieldname,
      categoria,
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension: ext,
      size: file.size,
      storageKey,
      uploadedAt: new Date(),
      uploadedBy: actorId,
    });
  }

  const etapaConcluida = Math.max(4, assistido.etapaConcluida || 0);

  const atualizado = await Assistido.findByIdAndUpdate(
    assistido._id,
    {
      $push: { anexos: { $each: novosAnexos } },
      etapaConcluida,
      atualizadoPor: actorId,
    },
    { new: true }
  );

  return {
    mensagem: `${novosAnexos.length} anexo(s) enviado(s) com sucesso.`,
    assistido: atualizado,
    anexos: novosAnexos,
    audit: {
      acao: "ASSISTIDO_ANEXOS_ENVIADOS",
      entidade: "assistido",
      entidadeId: assistido._id,
      detalhes: { quantidade: novosAnexos.length },
    },
  };
}

// ── Visualizar/download de anexo ───────────────────────────────────────────

async function abrirAnexoAssistido({ assistidoId, attachmentId }) {
  const assistido = await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "anexos",
    requireActive: false,
  });

  const anexo = assistido.anexos.find((a) => a.attachmentId === attachmentId);
  if (!anexo) throw createAssistidoError("Anexo não encontrado.", 404);

  const fullPath = resolveStoragePath(anexo.storageKey);
  if (!fs.existsSync(fullPath)) {
    throw createAssistidoError("Arquivo não encontrado no servidor.", 404);
  }

  return { anexo, fullPath };
}

module.exports = {
  criarAssistido,
  salvarDadosPessoais,
  salvarEndereco,
  confirmarCadastro,
  alterarStatusAssistido,
  uploadAnexosAssistido,
  abrirAnexoAssistido,
};
