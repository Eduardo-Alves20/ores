const express = require("express");
const BuscaController = require("../Controllers/BuscaController");

const router = express.Router();

router.get("/busca", BuscaController.buscar);

module.exports = router;

