const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento } = require("../../schemas/social/Atendimento");
const { registrarAuditoria } = require("../../services/auditService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getActorId(req) {
  return req?.session?.user?.id || null;
}

class FamiliaController {
  static async listar(req, res) {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const busca = String(req.query.busca || "").trim().slice(0, 100);
      const ativo = parseBoolean(req.query.ativo);
      const parentesco = String(req.query.parentesco || "").trim().slice(0, 60);
      const cidade = String(req.query.cidade || "").trim().slice(0, 80);
      const sortBy = String(req.query.sortBy || "updatedAt");
      const sortDir = String(req.query.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;
      const filtro = {};
      const allowedSortFields = new Set(["updatedAt", "createdAt", "responsavel.nome"]);

      if (typeof ativo !== "undefined") filtro.ativo = ativo;
      if (parentesco) filtro["responsavel.parentesco"] = new RegExp(`^${escapeRegex(parentesco)}$`, "i");
      if (cidade) filtro["endereco.cidade"] = new RegExp(escapeRegex(cidade), "i");

      const sortField = allowedSortFields.has(sortBy) ? sortBy : "updatedAt";
      const sort = { [sortField]: sortDir };

      if (busca) {
        const rx = new RegExp(escapeRegex(busca), "i");
        filtro.$or = [
          { "responsavel.nome": rx },
          { "responsavel.telefone": rx },
          { "responsavel.email": rx },
          { "endereco.cidade": rx },
          { "responsavel.parentesco": rx },
        ];
      }

      const result = await Familia.paginate(filtro, {
        page,
        limit,
        sort,
        lean: true,
      });

      const ids = result.docs.map((doc) => doc._id);
      const countByFamilia = await Paciente.aggregate([
        { $match: { familiaId: { $in: ids }, ativo: true } },
        { $group: { _id: "$familiaId", total: { $sum: 1 } } },
      ]);

      const mapCount = new Map(countByFamilia.map((c) => [String(c._id), c.total]));
      result.docs = result.docs.map((doc) => ({
        ...doc,
        pacientesAtivos: mapCount.get(String(doc._id)) || 0,
      }));

      return res.status(200).json(result);
    } catch (error) {
      console.error("Erro ao listar familias:", error);
      return res.status(500).json({ erro: "Erro interno ao listar familias." });
    }
  }

  static async detalhar(req, res) {
    try {
      const { id } = req.params;
      const incluirInativos = parseBoolean(req.query.incluirInativos) === true;

      const familia = await Familia.findById(id).lean();
      if (!familia) {
        return res.status(404).json({ erro: "Familia nao encontrada." });
      }

      const pacientes = await Paciente.find({
        familiaId: id,
        ...(incluirInativos ? {} : { ativo: true }),
      })
        .sort({ nome: 1 })
        .lean();

      const atendimentos = await Atendimento.find({
        familiaId: id,
        ...(incluirInativos ? {} : { ativo: true }),
      })
        .sort({ dataHora: -1 })
        .limit(200)
        .lean();

      return res.status(200).json({
        familia,
        pacientes,
        atendimentos,
      });
    } catch (error) {
      console.error("Erro ao detalhar familia:", error);
      return res.status(500).json({ erro: "Erro interno ao detalhar familia." });
    }
  }

  static async criar(req, res) {
    try {
      const { responsavel = {}, endereco = {}, observacoes } = req.body || {};
      const nome = String(responsavel.nome || "").trim();
      const telefone = String(responsavel.telefone || "").trim();
      const email = String(responsavel.email || "").trim().toLowerCase();
      const parentesco = String(responsavel.parentesco || "responsavel").trim();

      if (!nome || !telefone) {
        return res.status(400).json({
          erro: "Campos obrigatorios do responsavel: nome e telefone.",
        });
      }

      const actorId = getActorId(req);

      const familia = await Familia.create({
        responsavel: {
          nome,
          telefone,
          email: email || undefined,
          parentesco: parentesco || "responsavel",
        },
        endereco,
        observacoes,
        ativo: true,
        criadoPor: actorId,
        atualizadoPor: actorId,
      });

      await registrarAuditoria(req, {
        acao: "FAMILIA_CRIADA",
        entidade: "familia",
        entidadeId: familia._id,
      });

      return res.status(201).json({
        mensagem: "Familia cadastrada com sucesso.",
        familia,
      });
    } catch (error) {
      console.error("Erro ao criar familia:", error);
      return res.status(500).json({ erro: "Erro interno ao criar familia." });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const actorId = getActorId(req);
      const { responsavel, endereco, observacoes } = req.body || {};

      const patch = {
        atualizadoPor: actorId,
      };

      if (responsavel) {
        if (typeof responsavel.nome !== "undefined") patch["responsavel.nome"] = String(responsavel.nome).trim();
        if (typeof responsavel.telefone !== "undefined") patch["responsavel.telefone"] = String(responsavel.telefone).trim();
        if (typeof responsavel.email !== "undefined") patch["responsavel.email"] = String(responsavel.email || "").trim().toLowerCase();
        if (typeof responsavel.parentesco !== "undefined") patch["responsavel.parentesco"] = String(responsavel.parentesco || "responsavel").trim();
      }

      if (typeof observacoes !== "undefined") patch.observacoes = observacoes;
      if (typeof endereco !== "undefined") patch.endereco = endereco;

      const familia = await Familia.findByIdAndUpdate(id, patch, {
        new: true,
        runValidators: true,
      });

      if (!familia) {
        return res.status(404).json({ erro: "Familia nao encontrada." });
      }

      await registrarAuditoria(req, {
        acao: "FAMILIA_ATUALIZADA",
        entidade: "familia",
        entidadeId: id,
      });

      return res.status(200).json({
        mensagem: "Familia atualizada com sucesso.",
        familia,
      });
    } catch (error) {
      console.error("Erro ao atualizar familia:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar familia." });
    }
  }

  static async alterarStatus(req, res) {
    try {
      const { id } = req.params;
      const ativo = parseBoolean(req.body?.ativo);
      const actorId = getActorId(req);

      if (typeof ativo === "undefined") {
        return res.status(400).json({ erro: "Campo ativo e obrigatorio." });
      }

      const patch = {
        ativo,
        atualizadoPor: actorId,
        inativadoEm: ativo ? null : new Date(),
        inativadoPor: ativo ? null : actorId,
      };

      const familia = await Familia.findByIdAndUpdate(id, patch, {
        new: true,
        runValidators: true,
      });

      if (!familia) {
        return res.status(404).json({ erro: "Familia nao encontrada." });
      }

      await registrarAuditoria(req, {
        acao: ativo ? "FAMILIA_REATIVADA" : "FAMILIA_INATIVADA",
        entidade: "familia",
        entidadeId: id,
      });

      return res.status(200).json({
        mensagem: "Status da familia atualizado com sucesso.",
        familia,
      });
    } catch (error) {
      console.error("Erro ao alterar status da familia:", error);
      return res.status(500).json({ erro: "Erro interno ao alterar status da familia." });
    }
  }
}

module.exports = FamiliaController;


