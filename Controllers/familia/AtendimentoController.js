const Familia = require("../../schemas/social/Familia");
const mongoose = require("mongoose");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento } = require("../../schemas/social/Atendimento");
const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const { registrarAuditoria } = require("../../services/auditService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function getActorId(req) {
  return req?.session?.user?.id || null;
}

async function buscarProfissionalAtendido(profissionalId) {
  const raw = String(profissionalId || "").trim();
  if (!raw) return null;
  if (!mongoose.isValidObjectId(raw)) return undefined;

  return Usuario.findOne({
    _id: raw,
    tipoCadastro: "voluntario",
    perfil: PERFIS.USUARIO,
    statusAprovacao: "aprovado",
    ativo: true,
  }).select("_id nome login email");
}

class AtendimentoController {
  static async listarPorFamilia(req, res) {
    try {
      const { familiaId } = req.params;
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const ativo = parseBoolean(req.query.ativo);

      const familia = await Familia.findById(familiaId).select("_id");
      if (!familia) {
        return res.status(404).json({ erro: "Familia nao encontrada." });
      }

      const filtro = { familiaId };
      if (typeof ativo !== "undefined") filtro.ativo = ativo;

      const atendimentos = await Atendimento.paginate(filtro, {
        page,
        limit,
        sort: "-dataHora",
        populate: {
          path: "profissionalId",
          select: "nome login email",
        },
        lean: true,
      });

      return res.status(200).json(atendimentos);
    } catch (error) {
      console.error("Erro ao listar atendimentos:", error);
      return res.status(500).json({ erro: "Erro interno ao listar atendimentos." });
    }
  }

  static async criar(req, res) {
    try {
      const { familiaId } = req.params;
      const actorId = getActorId(req);
      const { pacienteId, profissionalId, dataHora, tipo, resumo, proximosPassos } = req.body || {};

      const familia = await Familia.findById(familiaId).select("_id ativo");
      if (!familia || !familia.ativo) {
        return res.status(404).json({ erro: "Familia nao encontrada ou inativa." });
      }

      if (!resumo || !String(resumo).trim()) {
        return res.status(400).json({ erro: "Campo resumo e obrigatorio." });
      }

      if (pacienteId) {
        const paciente = await Paciente.findOne({ _id: pacienteId, familiaId }).select("_id");
        if (!paciente) {
          return res.status(400).json({ erro: "Paciente nao pertence a esta familia." });
        }
      }

      const profissional = await buscarProfissionalAtendido(profissionalId);
      if (String(profissionalId || "").trim() && !profissional) {
        return res.status(400).json({
          erro: "Profissional/voluntario informado nao foi encontrado ou nao esta apto para atendimento.",
        });
      }

      const atendimento = await Atendimento.create({
        familiaId,
        pacienteId: pacienteId || null,
        profissionalId: profissional?._id || null,
        dataHora: dataHora || new Date(),
        tipo: tipo || "outro",
        resumo: String(resumo).trim(),
        proximosPassos,
        ativo: true,
        criadoPor: actorId,
        atualizadoPor: actorId,
      });

      await registrarAuditoria(req, {
        acao: "ATENDIMENTO_CRIADO",
        entidade: "atendimento",
        entidadeId: atendimento._id,
        detalhes: {
          familiaId,
          pacienteId: pacienteId || null,
          profissionalId: profissional?._id || null,
        },
      });

      return res.status(201).json({
        mensagem: "Atendimento registrado com sucesso.",
        atendimento,
      });
    } catch (error) {
      console.error("Erro ao criar atendimento:", error);
      return res.status(500).json({ erro: "Erro interno ao criar atendimento." });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const actorId = getActorId(req);
      const { pacienteId, profissionalId, dataHora, tipo, resumo, proximosPassos } = req.body || {};

      const atual = await Atendimento.findById(id).select("_id familiaId pacienteId");
      if (!atual) {
        return res.status(404).json({ erro: "Atendimento nao encontrado." });
      }

      const patch = {
        atualizadoPor: actorId,
      };

      if (typeof pacienteId !== "undefined") {
        if (!pacienteId) {
          patch.pacienteId = null;
        } else {
          const paciente = await Paciente.findOne({ _id: pacienteId, familiaId: atual.familiaId }).select("_id");
          if (!paciente) {
            return res.status(400).json({ erro: "Paciente nao pertence a esta familia." });
          }
          patch.pacienteId = pacienteId;
        }
      }

      if (typeof profissionalId !== "undefined") {
        const rawProfissionalId = String(profissionalId || "").trim();
        if (!rawProfissionalId) {
          patch.profissionalId = null;
        } else {
          const profissional = await buscarProfissionalAtendido(rawProfissionalId);
          if (!profissional) {
            return res.status(400).json({
              erro: "Profissional/voluntario informado nao foi encontrado ou nao esta apto para atendimento.",
            });
          }
          patch.profissionalId = profissional._id;
        }
      }

      if (typeof dataHora !== "undefined") {
        const parsed = new Date(dataHora);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ erro: "Data e hora invalidas." });
        }
        patch.dataHora = parsed;
      }

      if (typeof tipo !== "undefined") {
        patch.tipo = tipo || "outro";
      }

      if (typeof resumo !== "undefined") {
        const resumoTrim = String(resumo || "").trim();
        if (!resumoTrim) {
          return res.status(400).json({ erro: "Campo resumo e obrigatorio." });
        }
        patch.resumo = resumoTrim;
      }

      if (typeof proximosPassos !== "undefined") {
        patch.proximosPassos = proximosPassos;
      }

      const atendimento = await Atendimento.findByIdAndUpdate(id, patch, {
        new: true,
        runValidators: true,
      });

      if (!atendimento) {
        return res.status(404).json({ erro: "Atendimento nao encontrado." });
      }

      await registrarAuditoria(req, {
        acao: "ATENDIMENTO_ATUALIZADO",
        entidade: "atendimento",
        entidadeId: id,
        detalhes: {
          familiaId: atendimento.familiaId,
          pacienteId: atendimento.pacienteId,
          profissionalId: atendimento.profissionalId,
        },
      });

      return res.status(200).json({
        mensagem: "Atendimento atualizado com sucesso.",
        atendimento,
      });
    } catch (error) {
      console.error("Erro ao atualizar atendimento:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar atendimento." });
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

      const atendimento = await Atendimento.findByIdAndUpdate(
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

      if (!atendimento) {
        return res.status(404).json({ erro: "Atendimento nao encontrado." });
      }

      await registrarAuditoria(req, {
        acao: ativo ? "ATENDIMENTO_REATIVADO" : "ATENDIMENTO_INATIVADO",
        entidade: "atendimento",
        entidadeId: id,
        detalhes: {
          familiaId: atendimento.familiaId,
          pacienteId: atendimento.pacienteId,
        },
      });

      return res.status(200).json({
        mensagem: "Status do atendimento atualizado com sucesso.",
        atendimento,
      });
    } catch (error) {
      console.error("Erro ao alterar status do atendimento:", error);
      return res.status(500).json({ erro: "Erro interno ao alterar status do atendimento." });
    }
  }
}

module.exports = AtendimentoController;


