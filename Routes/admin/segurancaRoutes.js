const express = require("express");
const SegurancaController = require("../../Controllers/admin/SegurancaController");
const { requireAuth, requireSuperAdmin } = require("../../middlewares/authSession");

const router = express.Router();

router.get(
  "/seguranca/funcoes",
  requireAuth,
  requireSuperAdmin,
  SegurancaController.index
);

router.post(
  "/seguranca/funcoes",
  requireAuth,
  requireSuperAdmin,
  SegurancaController.criarFuncao
);

router.post(
  "/seguranca/funcoes/:id/update",
  requireAuth,
  requireSuperAdmin,
  SegurancaController.atualizarFuncao
);

router.post(
  "/seguranca/funcoes/:id/status",
  requireAuth,
  requireSuperAdmin,
  SegurancaController.alterarStatusFuncao
);

router.post(
  "/seguranca/usuarios/:id/funcoes",
  requireAuth,
  requireSuperAdmin,
  SegurancaController.atribuirFuncoes
);

module.exports = router;


