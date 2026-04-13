const express = require("express");
const multer = require("multer");

const UsuarioController = require("../../Controllers/admin/UsuarioController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");
const { ASSET_DEFINITIONS } = require("../../services/security/secureVolunteerAssetService");

const router = express.Router();

router.use(requirePermission(PERMISSIONS.USUARIOS_MANAGE));

const secureUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: Math.max(
      ASSET_DEFINITIONS.documentoIdentidade.maxBytes,
      ASSET_DEFINITIONS.fotoPerfil.maxBytes
    ),
  },
});

function handleSecureUpload(req, res, next) {
  secureUpload.single("arquivo")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        erro: "O arquivo excede o limite permitido para anexos protegidos.",
      });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        erro: "Falha ao receber o arquivo protegido.",
      });
    }

    return res.status(400).json({
      erro: error?.message || "Falha ao receber o arquivo protegido.",
    });
  });
}

// LISTAR (com paginação e filtros)
// GET /usuarios?page=1&limit=10&busca=joao&ativo=true&perfil=admin
router.get("/", UsuarioController.listar);

// UPLOAD PROTEGIDO DE DOCUMENTOS/FOTOS
router.post("/uploads/protegidos", handleSecureUpload, UsuarioController.uploadAnexoProtegido);

// BUSCAR POR ID
router.get("/:id", UsuarioController.buscarPorId);

// CRIAR
router.post("/", UsuarioController.criar);

// ATUALIZAR DADOS
router.put("/:id", UsuarioController.atualizar);

// ATUALIZAR SENHA
router.patch("/:id/senha", UsuarioController.atualizarSenha);

// ALTERAR STATUS (ativo/inativo)
router.patch("/:id/status", UsuarioController.alterarStatus);

// REMOVER
router.delete("/:id", UsuarioController.remover);

module.exports = router;
