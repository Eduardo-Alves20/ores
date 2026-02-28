const Familia = require("../schemas/Familia");
const { Paciente } = require("../schemas/Paciente");
const { registrarAuditoria } = require("../services/auditService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function getActorId(req) {
  return req?.session?.user?.id || null;
}

class PacienteController {
  static async listarPorFamilia(req, res) {
    try {
      const { familiaId } = req.params;
      const ativo = parseBoolean(req.query.ativo);

      const familia = await Familia.findById(familiaId).select("_id");
      if (!familia) {
        return res.status(404).json({ erro: "Familia nao encontrada." });
      }

      const filtro = { familiaId };
      if (typeof ativo !== "undefined") filtro.ativo = ativo;

      const pacientes = await Paciente.find(filtro).sort({ nome: 1 }).lean();

      return res.status(200).json({ pacientes });
    } catch (error) {
      console.error("Erro ao listar pacientes:", error);
      return res.status(500).json({ erro: "Erro interno ao listar pacientes." });
    }
  }

  static async criar(req, res) {
    try {
      const { familiaId } = req.params;
      const familia = await Familia.findById(familiaId).select("_id ativo");

      if (!familia || !familia.ativo) {
        return res.status(404).json({ erro: "Familia nao encontrada ou inativa." });
      }

      const {
        nome,
        dataNascimento,
        tipoDeficiencia,
        necessidadesApoio,
        observacoes,
        diagnosticoResumo,
      } = req.body || {};

      if (!nome) {
        return res.status(400).json({ erro: "Campo nome e obrigatorio." });
      }

      const actorId = getActorId(req);
      const paciente = await Paciente.create({
        familiaId,
        nome: String(nome).trim(),
        dataNascimento: dataNascimento || null,
        tipoDeficiencia: tipoDeficiencia || "outra",
        necessidadesApoio,
        observacoes,
        diagnosticoResumo,
        ativo: true,
        criadoPor: actorId,
        atualizadoPor: actorId,
      });

      await registrarAuditoria(req, {
        acao: "PACIENTE_CRIADO",
        entidade: "paciente",
        entidadeId: paciente._id,
        detalhes: { familiaId },
      });

      return res.status(201).json({
        mensagem: "Paciente cadastrado com sucesso.",
        paciente,
      });
    } catch (error) {
      console.error("Erro ao criar paciente:", error);
      return res.status(500).json({ erro: "Erro interno ao criar paciente." });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const actorId = getActorId(req);
      const {
        nome,
        dataNascimento,
        tipoDeficiencia,
        necessidadesApoio,
        observacoes,
        diagnosticoResumo,
      } = req.body || {};

      const patch = {
        atualizadoPor: actorId,
      };

      if (typeof nome !== "undefined") patch.nome = String(nome).trim();
      if (typeof dataNascimento !== "undefined") patch.dataNascimento = dataNascimento || null;
      if (typeof tipoDeficiencia !== "undefined") patch.tipoDeficiencia = tipoDeficiencia || "outra";
      if (typeof necessidadesApoio !== "undefined") patch.necessidadesApoio = necessidadesApoio;
      if (typeof observacoes !== "undefined") patch.observacoes = observacoes;
      if (typeof diagnosticoResumo !== "undefined") patch.diagnosticoResumo = diagnosticoResumo;

      const paciente = await Paciente.findByIdAndUpdate(id, patch, {
        new: true,
        runValidators: true,
      });

      if (!paciente) {
        return res.status(404).json({ erro: "Paciente nao encontrado." });
      }

      await registrarAuditoria(req, {
        acao: "PACIENTE_ATUALIZADO",
        entidade: "paciente",
        entidadeId: id,
        detalhes: { familiaId: paciente.familiaId },
      });

      return res.status(200).json({
        mensagem: "Paciente atualizado com sucesso.",
        paciente,
      });
    } catch (error) {
      console.error("Erro ao atualizar paciente:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar paciente." });
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

      const paciente = await Paciente.findByIdAndUpdate(
        id,
        {
          ativo,
          atualizadoPor: actorId,
          inativadoEm: ativo ? null : new Date(),
          inativadoPor: ativo ? null : actorId,
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!paciente) {
        return res.status(404).json({ erro: "Paciente nao encontrado." });
      }

      await registrarAuditoria(req, {
        acao: ativo ? "PACIENTE_REATIVADO" : "PACIENTE_INATIVADO",
        entidade: "paciente",
        entidadeId: id,
        detalhes: { familiaId: paciente.familiaId },
      });

      return res.status(200).json({
        mensagem: "Status do paciente atualizado com sucesso.",
        paciente,
      });
    } catch (error) {
      console.error("Erro ao alterar status do paciente:", error);
      return res.status(500).json({ erro: "Erro interno ao alterar status do paciente." });
    }
  }
}

module.exports = PacienteController;

