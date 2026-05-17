const express = require("express");
const multer = require("multer");
const AssistidoController = require("../../Controllers/assistido/AssistidoController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

const router = express.Router();

const assistidoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 30,
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

function handleAttachmentUpload(req, res, next) {
  assistidoUpload.any()(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ erro: "Um dos anexos excede o limite de 10MB." });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ erro: "Falha ao receber os anexos." });
    }

    return res.status(400).json({ erro: error?.message || "Falha ao receber os anexos." });
  });
}

// ── Utilitário ─────────────────────────────────────────────────────────────
router.get("/cep/:cep", requirePermission(PERMISSIONS.ASSISTIDOS_VIEW), AssistidoController.buscarCep);

// ── Listagem e detalhe ─────────────────────────────────────────────────────
router.get("/", requirePermission(PERMISSIONS.ASSISTIDOS_VIEW), AssistidoController.listar);
router.get("/:id", requirePermission(PERMISSIONS.ASSISTIDOS_VIEW), AssistidoController.detalhar);

// ── Wizard de cadastro ─────────────────────────────────────────────────────
// Etapa 0: inicia rascunho
router.post(
  "/",
  requirePermission(PERMISSIONS.ASSISTIDOS_CREATE),
  AssistidoController.iniciarCadastro
);

// Etapa 1: dados pessoais
router.patch(
  "/:id/dados-pessoais",
  requirePermission(PERMISSIONS.ASSISTIDOS_UPDATE),
  AssistidoController.salvarDadosPessoais
);

// Etapa 2: endereço
router.patch(
  "/:id/endereco",
  requirePermission(PERMISSIONS.ASSISTIDOS_UPDATE),
  AssistidoController.salvarEndereco
);

// Etapa 5: confirmar cadastro
router.patch(
  "/:id/confirmar",
  requirePermission(PERMISSIONS.ASSISTIDOS_UPDATE),
  AssistidoController.confirmarCadastro
);

// Status (ativar/inativar)
router.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.ASSISTIDOS_STATUS),
  AssistidoController.alterarStatus
);

// ── Ficha de Anamnese (etapa 3) ────────────────────────────────────────────
router.get(
  "/:id/anamnese",
  requirePermission(PERMISSIONS.ANAMNESE_READ_CARE_TEAM),
  AssistidoController.listarAnamneses
);

router.get(
  "/:id/anamnese/atual",
  requirePermission(PERMISSIONS.ANAMNESE_READ_CARE_TEAM),
  AssistidoController.buscarAnamneseAtual
);

router.get(
  "/:id/anamnese/:versao",
  requirePermission(PERMISSIONS.ANAMNESE_READ_CARE_TEAM),
  AssistidoController.buscarAnamnesePorVersao
);

router.post(
  "/:id/anamnese",
  requirePermission(PERMISSIONS.ANAMNESE_CREATE_UPDATE),
  AssistidoController.criarAnamnese
);

// ── Entrevista Social (etapa 4) ────────────────────────────────────────────
router.get(
  "/:id/entrevista",
  requirePermission(PERMISSIONS.ENTREVISTA_SOCIAL_READ_OWN),
  AssistidoController.listarEntrevistas
);

router.get(
  "/:id/entrevista/atual",
  requirePermission(PERMISSIONS.ENTREVISTA_SOCIAL_READ_OWN),
  AssistidoController.buscarEntrevistaAtual
);

router.get(
  "/:id/entrevista/:versao",
  requirePermission(PERMISSIONS.ENTREVISTA_SOCIAL_READ_OWN),
  AssistidoController.buscarEntrevistaPorVersao
);

router.post(
  "/:id/entrevista",
  requirePermission(PERMISSIONS.ENTREVISTA_SOCIAL_CREATE),
  AssistidoController.criarEntrevista
);

// ── Anexos (etapa 5) ───────────────────────────────────────────────────────
router.post(
  "/:id/anexos",
  requirePermission(PERMISSIONS.ASSISTIDOS_UPDATE),
  handleAttachmentUpload,
  AssistidoController.uploadAnexos
);

router.get(
  "/:id/anexos/:attachmentId",
  requirePermission(PERMISSIONS.ASSISTIDOS_VIEW),
  AssistidoController.visualizarAnexo
);

module.exports = router;
