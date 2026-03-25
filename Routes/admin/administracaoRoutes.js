const express = require("express");

const AdministracaoController = require("../../Controllers/admin/AdministracaoController");
const { requireAdmin } = require("../../middlewares/authSession");

const router = express.Router();

router.use(requireAdmin);

router.get("/", AdministracaoController.page);
router.get("/configuracoes", AdministracaoController.config);

router.post("/justificativas", AdministracaoController.criarJustificativa);
router.put("/justificativas/:id", AdministracaoController.atualizarJustificativa);
router.patch("/justificativas/:id/status", AdministracaoController.alterarStatusJustificativa);

router.post("/campos", AdministracaoController.criarCampo);
router.put("/campos/:id", AdministracaoController.atualizarCampo);
router.patch("/campos/:id/status", AdministracaoController.alterarStatusCampo);

router.post("/filtros", AdministracaoController.criarFiltro);
router.put("/filtros/:id", AdministracaoController.atualizarFiltro);
router.patch("/filtros/:id/status", AdministracaoController.alterarStatusFiltro);

router.post("/campanhas-aniversario", AdministracaoController.criarCampanhaAniversario);
router.put("/campanhas-aniversario/:id", AdministracaoController.atualizarCampanhaAniversario);
router.patch("/campanhas-aniversario/:id/status", AdministracaoController.alterarStatusCampanhaAniversario);

module.exports = router;
