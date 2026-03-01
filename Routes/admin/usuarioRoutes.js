const express = require("express");
const router = express.Router();

const UsuarioController = require("../../Controllers/admin/UsuarioController");
const { requirePermission } = require("../../middlewares/authSession");
const { PERMISSIONS } = require("../../config/permissions");

router.use(requirePermission(PERMISSIONS.USUARIOS_MANAGE));

// LISTAR (com paginaÃ§Ã£o e filtros)
// GET /usuarios?page=1&limit=10&busca=joao&ativo=true&perfil=admin
router.get("/", UsuarioController.listar);

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


