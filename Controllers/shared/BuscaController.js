const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class BuscaController {
  static async buscar(req, res) {
    try {
      const termo = String(req.query.termo || "").trim().slice(0, 100);
      if (!termo) {
        return res.status(400).json({ erro: "Informe o parametro termo." });
      }

      const rx = new RegExp(escapeRegex(termo), "i");

      const [familias, pacientes] = await Promise.all([
        Familia.find({
          ativo: true,
          $or: [
            { "responsavel.nome": rx },
            { "responsavel.telefone": rx },
          ],
        })
          .select("_id responsavel ativo createdAt")
          .sort({ updatedAt: -1 })
          .limit(30)
          .lean(),
        Paciente.find({
          ativo: true,
          nome: rx,
        })
          .populate({
            path: "familiaId",
            select: "_id responsavel.nome responsavel.telefone ativo",
          })
          .select("_id nome familiaId tipoDeficiencia dataNascimento")
          .sort({ nome: 1 })
          .limit(30)
          .lean(),
      ]);

      return res.status(200).json({
        termo,
        totalResultados: familias.length + pacientes.length,
        familias,
        pacientes,
      });
    } catch (error) {
      console.error("Erro na busca rapida:", error);
      return res.status(500).json({ erro: "Erro interno na busca." });
    }
  }
}

module.exports = BuscaController;



