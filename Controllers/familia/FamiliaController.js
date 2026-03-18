const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento } = require("../../schemas/social/Atendimento");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const { registrarAuditoria } = require("../../services/auditService");
const { normalizeCustomFieldValues } = require("../../services/systemConfigService");
const { parseBoolean } = require("../../services/shared/valueParsingService");
const { toDateTimeLabel } = require("../../services/shared/dateFormattingService");
const { escapeRegex } = require("../../services/shared/searchUtilsService");
const {
  hasOwnAssistidosScope,
  resolveScopedFamilyIds,
  canAccessFamily,
} = require("../../services/volunteerScopeService");

function getActorId(req) {
  return req?.session?.user?.id || null;
}

function getSessionUser(req) {
  return req?.session?.user || null;
}

const AGENDA_STATUS_LABELS = Object.freeze({
  agendado: "Agendado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  em_analise_cancelamento: "Em analise de cancelamento",
  em_negociacao_remarcacao: "Em negociacao de remarcacao",
  remarcado: "Remarcado",
});

const PRESENCA_STATUS_LABELS = Object.freeze({
  pendente: "Pendente",
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  cancelado_antecipadamente: "Cancelado antecipadamente",
});

function mapAgendaPresenca(doc) {
  return {
    _id: doc?._id,
    titulo: doc?.titulo || "Consulta",
    inicio: doc?.inicio || null,
    inicioLabel: doc?.inicio ? toDateTimeLabel(doc.inicio) : "-",
    tipoAtendimento: doc?.tipoAtendimento || "outro",
    statusAgendamento: doc?.statusAgendamento || "agendado",
    statusAgendamentoLabel:
      AGENDA_STATUS_LABELS[doc?.statusAgendamento || "agendado"] || "Agendado",
    statusPresenca: doc?.statusPresenca || "pendente",
    statusPresencaLabel:
      PRESENCA_STATUS_LABELS[doc?.statusPresenca || "pendente"] || "Pendente",
    presencaObservacao: doc?.presencaObservacao || "",
    presencaJustificativaLabel: doc?.presencaJustificativaLabel || "",
    local: doc?.local || "",
    salaNome: doc?.salaId?.nome || "",
    pacienteNome: doc?.pacienteId?.nome || "",
    responsavelNome: doc?.responsavelId?.nome || "",
    presencaRegistradaEm: doc?.presencaRegistradaEm || null,
    presencaRegistradaEmLabel: doc?.presencaRegistradaEm
      ? toDateTimeLabel(doc.presencaRegistradaEm)
      : "-",
    presencaRegistradaPorNome: doc?.presencaRegistradaPor?.nome || "",
    ativo: !!doc?.ativo,
  };
}

class FamiliaController {
  static async listar(req, res) {
    try {
      const user = getSessionUser(req);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
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

      const scopedFamilyIds = await resolveScopedFamilyIds(user);
      if (Array.isArray(scopedFamilyIds)) {
        filtro._id = { $in: scopedFamilyIds };
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
      const user = getSessionUser(req);
      const incluirInativos = parseBoolean(req.query.incluirInativos) === true;

      if (!(await canAccessFamily(user, id))) {
        return res.status(403).json({ erro: "Acesso restrito a familias vinculadas ao proprio atendimento." });
      }

      const familia = await Familia.findById(id).lean();
      if (!familia) {
        return res.status(404).json({ erro: "Familia nao encontrada." });
      }

      const [pacientes, atendimentos, voluntarios, presencasAgenda] = await Promise.all([
        Paciente.find({
          familiaId: id,
          ...(incluirInativos ? {} : { ativo: true }),
        })
          .sort({ nome: 1 })
          .lean(),
        Atendimento.find({
          familiaId: id,
          ...(incluirInativos ? {} : { ativo: true }),
        })
          .sort({ dataHora: -1 })
          .limit(200)
          .populate({
            path: "profissionalId",
            select: "nome login email",
          })
          .lean(),
        hasOwnAssistidosScope(user)
          ? Usuario.find({
              _id: getActorId(req),
              ativo: true,
            })
              .select("_id nome login email")
              .lean()
          : Usuario.find({
              tipoCadastro: "voluntario",
              perfil: PERFIS.USUARIO,
              statusAprovacao: "aprovado",
              ativo: true,
            })
              .sort({ nome: 1 })
              .select("_id nome login email")
              .lean(),
        AgendaEvento.find({
          familiaId: id,
          ...(incluirInativos ? {} : { ativo: true }),
        })
          .sort({ inicio: -1 })
          .limit(200)
          .populate("responsavelId", "_id nome")
          .populate("pacienteId", "_id nome")
          .populate("salaId", "_id nome")
          .populate("presencaRegistradaPor", "_id nome")
          .lean(),
      ]);

      return res.status(200).json({
        familia,
        pacientes,
        atendimentos,
        voluntarios,
        presencasAgenda: (presencasAgenda || []).map(mapAgendaPresenca),
      });
    } catch (error) {
      console.error("Erro ao detalhar familia:", error);
      return res.status(500).json({ erro: "Erro interno ao detalhar familia." });
    }
  }

  static async criar(req, res) {
    try {
      const { responsavel = {}, endereco = {}, observacoes, camposExtras = {} } = req.body || {};
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

      const normalizedCamposExtras = await normalizeCustomFieldValues("familia", camposExtras);

      const familia = await Familia.create({
        responsavel: {
          nome,
          telefone,
          email: email || undefined,
          parentesco: parentesco || "responsavel",
        },
        endereco,
        observacoes,
        camposExtras: normalizedCamposExtras,
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
      const { responsavel, endereco, observacoes, camposExtras } = req.body || {};

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
      if (typeof camposExtras !== "undefined") {
        patch.camposExtras = await normalizeCustomFieldValues("familia", camposExtras || {});
      }

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


