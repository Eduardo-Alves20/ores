const express = require("express");

const AdministracaoController = require("../../Controllers/admin/AdministracaoController");
const { requireAdmin } = require("../../middlewares/authSession");

const router = express.Router();

router.use(requireAdmin);

router.get("/administracao", AdministracaoController.page);
router.get("/api/administracao/configuracoes", AdministracaoController.config);

router.post("/api/administracao/justificativas", AdministracaoController.criarJustificativa);
router.put("/api/administracao/justificativas/:id", AdministracaoController.atualizarJustificativa);
router.patch("/api/administracao/justificativas/:id/status", AdministracaoController.alterarStatusJustificativa);

router.post("/api/administracao/campos", AdministracaoController.criarCampo);
router.put("/api/administracao/campos/:id", AdministracaoController.atualizarCampo);
router.patch("/api/administracao/campos/:id/status", AdministracaoController.alterarStatusCampo);

router.post("/api/administracao/filtros", AdministracaoController.criarFiltro);
router.put("/api/administracao/filtros/:id", AdministracaoController.atualizarFiltro);
router.patch("/api/administracao/filtros/:id/status", AdministracaoController.alterarStatusFiltro);

module.exports = router;
