const { Assistido } = require("../../schemas/social/Assistido");
const { escapeRegex } = require("../../services/shared/searchUtilsService");

class BuscaController {
  static async buscar(req, res) {
    try {
      const termo = String(req.query.termo || "").trim().slice(0, 100);
      if (!termo) {
        return res.status(400).json({ erro: "Informe o parametro termo." });
      }

      const rx = new RegExp(escapeRegex(termo), "i");

      const assistidos = await Assistido.find({
        ativo: true,
        $or: [
          { nome: rx },
          { telefonePrincipal: rx },
          { "responsavel.nome": rx },
          { "responsavel.telefone": rx },
        ],
      })
        .select("_id nome telefonePrincipal responsavel faixaEtaria ativo createdAt")
        .sort({ updatedAt: -1 })
        .limit(40)
        .lean();

      return res.status(200).json({
        termo,
        totalResultados: assistidos.length,
        assistidos,
      });
    } catch (error) {
      console.error("Erro na busca rapida:", error);
      return res.status(500).json({ erro: "Erro interno na busca." });
    }
  }
}

module.exports = BuscaController;
