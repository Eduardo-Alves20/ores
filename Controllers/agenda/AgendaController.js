const mongoose = require("mongoose");
const Familia = require("../../schemas/social/Familia");
const Usuario = require("../../schemas/core/Usuario");
const { Paciente } = require("../../schemas/social/Paciente");
const { AgendaEvento, TIPOS_AGENDA } = require("../../schemas/social/AgendaEvento");
const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { registrarAuditoria } = require("../../services/auditService");
const { hasAnyPermission } = require("../../services/accessControlService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function getSessionUser(req) {
  return req?.session?.user || null;
}

function canViewAll(user) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_VIEW_ALL]);
}

function canAssignOthers(user) {
  return hasAnyPermission(user?.permissions || [], [PERMISSIONS.AGENDA_ASSIGN_OTHERS]);
}

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function parseDateInput(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function getMonthRange(query) {
  const inicioQuery = parseDateInput(query?.inicio);
  const fimQuery = parseDateInput(query?.fim);

  if (inicioQuery && fimQuery) {
    return { inicio: inicioQuery, fim: fimQuery };
  }

  const ref = parseDateInput(query?.referencia) || new Date();
  const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0);
  return { inicio, fim };
}

function toDayDateString(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function toTimeString(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(11, 16);
}

function canMutateEvent(user, evento) {
  if (canViewAll(user)) return true;
  return String(evento?.responsavelId || "") === String(user?.id || "");
}

function sanitizeTitle(value) {
  return String(value || "").trim().slice(0, 140);
}

function isProvided(value) {
  return typeof value !== "undefined" && value !== null && String(value).trim() !== "";
}

async function resolveRelations({ familiaIdInput, pacienteIdInput }) {
  const familiaId = asObjectId(familiaIdInput);
  const pacienteId = asObjectId(pacienteIdInput);

  let resolvedFamiliaId = familiaId;
  let resolvedPacienteId = pacienteId;
  let familiaRef = null;

  if (resolvedPacienteId) {
    const paciente = await Paciente.findById(resolvedPacienteId).select("_id familiaId ativo");
    if (!paciente || !paciente.ativo) {
      return { error: "Paciente invalido ou inativo.", status: 400 };
    }

    if (resolvedFamiliaId && String(paciente.familiaId) !== String(resolvedFamiliaId)) {
      return { error: "Paciente nao pertence a familia informada.", status: 400 };
    }

    resolvedFamiliaId = paciente.familiaId;
  }

  if (resolvedFamiliaId) {
    const familia = await Familia.findById(resolvedFamiliaId).select("_id ativo");
    if (!familia || !familia.ativo) {
      return { error: "Familia invalida ou inativa.", status: 400 };
    }
    familiaRef = familia;
  }

  return {
    familiaId: resolvedFamiliaId || null,
    pacienteId: resolvedPacienteId || null,
    familiaRef,
  };
}

function mapEvento(doc) {
  const evento = doc?.toObject ? doc.toObject() : doc;
  const inicio = evento?.inicio ? new Date(evento.inicio) : null;

  return {
    _id: evento?._id,
    titulo: evento?.titulo || "",
    tipoAtendimento: evento?.tipoAtendimento || "outro",
    inicio: evento?.inicio,
    fim: evento?.fim || null,
    local: evento?.local || "",
    observacoes: evento?.observacoes || "",
    ativo: !!evento?.ativo,
    dia: inicio ? toDayDateString(inicio) : "",
    hora: inicio ? toTimeString(inicio) : "",
    familia: evento?.familiaId
      ? {
          _id: evento.familiaId._id || evento.familiaId,
          responsavelNome: evento.familiaId?.responsavel?.nome || "",
          cidade: evento.familiaId?.endereco?.cidade || "",
        }
      : null,
    paciente: evento?.pacienteId
      ? {
          _id: evento.pacienteId._id || evento.pacienteId,
          nome: evento.pacienteId?.nome || "",
        }
      : null,
    responsavel: evento?.responsavelId
      ? {
          _id: evento.responsavelId._id || evento.responsavelId,
          nome: evento.responsavelId?.nome || "",
          perfil: evento.responsavelId?.perfil || "",
        }
      : null,
  };
}

class AgendaController {
  static async listar(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_VIEW])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const { inicio, fim } = getMonthRange(req.query);
      if (!inicio || !fim || inicio >= fim) {
        return res.status(400).json({ erro: "Intervalo de datas invalido." });
      }

      const diffDays = Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays > 93) {
        return res.status(400).json({ erro: "Intervalo maximo permitido: 93 dias." });
      }

      const filtro = {
        inicio: {
          $gte: inicio,
          $lt: fim,
        },
      };

      const incluirInativos = parseBoolean(req.query?.incluirInativos) === true;
      if (!incluirInativos) filtro.ativo = true;

      if (canViewAll(user)) {
        const responsavelId = asObjectId(req.query?.responsavelId);
        if (responsavelId) filtro.responsavelId = responsavelId;
      } else {
        filtro.responsavelId = asObjectId(user.id);
      }

      const eventos = await AgendaEvento.find(filtro)
        .sort({ inicio: 1, createdAt: 1 })
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .lean();

      return res.status(200).json({
        inicio,
        fim,
        eventos: eventos.map(mapEvento),
      });
    } catch (error) {
      console.error("Erro ao listar agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao listar agenda." });
    }
  }

  static async listarProfissionais(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_VIEW])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      if (!canViewAll(user)) {
        return res.status(200).json({
          profissionais: [
            {
              _id: user.id,
              nome: user.nome,
              perfil: user.perfil,
            },
          ],
        });
      }

      const profissionais = await Usuario.find({
        ativo: true,
        perfil: { $in: [PERFIS.SUPERADMIN, PERFIS.ADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO] },
      })
        .select("_id nome perfil")
        .sort({ nome: 1 })
        .lean();

      return res.status(200).json({ profissionais });
    } catch (error) {
      console.error("Erro ao listar profissionais da agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao listar profissionais." });
    }
  }

  static async criar(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_CREATE])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const actorId = asObjectId(user.id);
      if (!actorId) {
        return res.status(401).json({ erro: "Sessao invalida." });
      }

      const titulo = sanitizeTitle(req.body?.titulo);
      const tipoAtendimento = String(req.body?.tipoAtendimento || "outro");
      const local = String(req.body?.local || "").trim().slice(0, 240);
      const observacoes = String(req.body?.observacoes || "").trim().slice(0, 3000);
      const inicio = parseDateInput(req.body?.inicio);
      const fim = parseDateInput(req.body?.fim);

      if (!titulo) {
        return res.status(400).json({ erro: "Campo titulo e obrigatorio." });
      }

      if (!inicio) {
        return res.status(400).json({ erro: "Campo inicio e obrigatorio." });
      }

      if (fim && fim <= inicio) {
        return res.status(400).json({ erro: "Data de fim deve ser maior que a data de inicio." });
      }

      if (!TIPOS_AGENDA.includes(tipoAtendimento)) {
        return res.status(400).json({ erro: "Tipo de atendimento invalido." });
      }

      if (isProvided(req.body?.familiaId) && !asObjectId(req.body?.familiaId)) {
        return res.status(400).json({ erro: "familiaId invalido." });
      }

      if (isProvided(req.body?.pacienteId) && !asObjectId(req.body?.pacienteId)) {
        return res.status(400).json({ erro: "pacienteId invalido." });
      }

      const relation = await resolveRelations({
        familiaIdInput: req.body?.familiaId || null,
        pacienteIdInput: req.body?.pacienteId || null,
      });

      if (relation.error) {
        return res.status(relation.status || 400).json({ erro: relation.error });
      }

      let responsavelId = actorId;
      if (canAssignOthers(user)) {
        const candidate = asObjectId(req.body?.responsavelId);
        if (isProvided(req.body?.responsavelId) && !candidate) {
          return res.status(400).json({ erro: "responsavelId invalido." });
        }
        if (candidate) responsavelId = candidate;
      }

      const responsavelExists = await Usuario.exists({ _id: responsavelId, ativo: true });
      if (!responsavelExists) {
        return res.status(400).json({ erro: "Responsavel informado esta inativo ou nao existe." });
      }

      const evento = await AgendaEvento.create({
        titulo,
        tipoAtendimento,
        inicio,
        fim: fim || null,
        local,
        observacoes,
        familiaId: relation.familiaId || null,
        pacienteId: relation.pacienteId || null,
        responsavelId,
        ativo: true,
        criadoPor: actorId,
        atualizadoPor: actorId,
      });

      await registrarAuditoria(req, {
        acao: "AGENDA_EVENTO_CRIADO",
        entidade: "agenda_evento",
        entidadeId: evento._id,
        detalhes: {
          responsavelId,
          familiaId: relation.familiaId || null,
          pacienteId: relation.pacienteId || null,
        },
      });

      const loaded = await AgendaEvento.findById(evento._id)
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .lean();

      return res.status(201).json({
        mensagem: "Agendamento criado com sucesso.",
        evento: mapEvento(loaded),
      });
    } catch (error) {
      console.error("Erro ao criar evento de agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao criar agendamento." });
    }
  }

  static async atualizar(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_UPDATE])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const evento = await AgendaEvento.findById(req.params?.id);
      if (!evento) {
        return res.status(404).json({ erro: "Evento de agenda nao encontrado." });
      }

      if (!canMutateEvent(user, evento)) {
        return res.status(403).json({ erro: "Sem permissao para alterar este evento." });
      }

      const actorId = asObjectId(user.id);
      const patch = { atualizadoPor: actorId };

      if (Object.prototype.hasOwnProperty.call(req.body, "titulo")) {
        const titulo = sanitizeTitle(req.body?.titulo);
        if (!titulo) return res.status(400).json({ erro: "Campo titulo nao pode ser vazio." });
        patch.titulo = titulo;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "tipoAtendimento")) {
        const tipoAtendimento = String(req.body?.tipoAtendimento || "").trim();
        if (!TIPOS_AGENDA.includes(tipoAtendimento)) {
          return res.status(400).json({ erro: "Tipo de atendimento invalido." });
        }
        patch.tipoAtendimento = tipoAtendimento;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "inicio")) {
        const inicio = parseDateInput(req.body?.inicio);
        if (!inicio) return res.status(400).json({ erro: "Data de inicio invalida." });
        patch.inicio = inicio;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "fim")) {
        if (!req.body?.fim) {
          patch.fim = null;
        } else {
          const fim = parseDateInput(req.body?.fim);
          if (!fim) return res.status(400).json({ erro: "Data de fim invalida." });
          patch.fim = fim;
        }
      }

      const nextInicio = patch.inicio || evento.inicio;
      const nextFim = Object.prototype.hasOwnProperty.call(patch, "fim") ? patch.fim : evento.fim;
      if (nextFim && nextFim <= nextInicio) {
        return res.status(400).json({ erro: "Data de fim deve ser maior que a data de inicio." });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "local")) {
        patch.local = String(req.body?.local || "").trim().slice(0, 240);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "observacoes")) {
        patch.observacoes = String(req.body?.observacoes || "").trim().slice(0, 3000);
      }

      const hasFamilia = Object.prototype.hasOwnProperty.call(req.body, "familiaId");
      const hasPaciente = Object.prototype.hasOwnProperty.call(req.body, "pacienteId");

      if (hasFamilia || hasPaciente) {
        if (hasFamilia && isProvided(req.body?.familiaId) && !asObjectId(req.body?.familiaId)) {
          return res.status(400).json({ erro: "familiaId invalido." });
        }
        if (hasPaciente && isProvided(req.body?.pacienteId) && !asObjectId(req.body?.pacienteId)) {
          return res.status(400).json({ erro: "pacienteId invalido." });
        }

        const familiaIdInput = hasFamilia ? req.body?.familiaId || null : evento.familiaId || null;
        const pacienteIdInput = hasPaciente ? req.body?.pacienteId || null : evento.pacienteId || null;

        const relation = await resolveRelations({ familiaIdInput, pacienteIdInput });
        if (relation.error) {
          return res.status(relation.status || 400).json({ erro: relation.error });
        }

        patch.familiaId = relation.familiaId || null;
        patch.pacienteId = relation.pacienteId || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "responsavelId")) {
        if (!canAssignOthers(user)) {
          return res.status(403).json({ erro: "Sem permissao para mudar responsavel." });
        }

        const responsavelId = asObjectId(req.body?.responsavelId);
        if (isProvided(req.body?.responsavelId) && !responsavelId) {
          return res.status(400).json({ erro: "Responsavel invalido." });
        }
        if (!responsavelId) {
          return res.status(400).json({ erro: "Responsavel invalido." });
        }

        const responsavelExists = await Usuario.exists({ _id: responsavelId, ativo: true });
        if (!responsavelExists) {
          return res.status(400).json({ erro: "Responsavel informado esta inativo ou nao existe." });
        }
        patch.responsavelId = responsavelId;
      }

      const updated = await AgendaEvento.findByIdAndUpdate(evento._id, patch, {
        new: true,
        runValidators: true,
      })
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .lean();

      await registrarAuditoria(req, {
        acao: "AGENDA_EVENTO_ATUALIZADO",
        entidade: "agenda_evento",
        entidadeId: evento._id,
      });

      return res.status(200).json({
        mensagem: "Agendamento atualizado com sucesso.",
        evento: mapEvento(updated),
      });
    } catch (error) {
      console.error("Erro ao atualizar evento de agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar agendamento." });
    }
  }

  static async mover(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_MOVE])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const evento = await AgendaEvento.findById(req.params?.id);
      if (!evento) {
        return res.status(404).json({ erro: "Evento de agenda nao encontrado." });
      }

      if (!canMutateEvent(user, evento)) {
        return res.status(403).json({ erro: "Sem permissao para mover este evento." });
      }

      const novoInicioCompleto = parseDateInput(req.body?.novoInicio);
      let novoInicio = novoInicioCompleto;

      if (!novoInicio) {
        const novaData = String(req.body?.novaData || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
          return res.status(400).json({ erro: "Informe novaData no formato YYYY-MM-DD." });
        }

        const [ano, mes, dia] = novaData.split("-").map(Number);
        const original = new Date(evento.inicio);
        novoInicio = new Date(
          ano,
          mes - 1,
          dia,
          original.getHours(),
          original.getMinutes(),
          original.getSeconds(),
          original.getMilliseconds()
        );
      }

      if (Number.isNaN(novoInicio.getTime())) {
        return res.status(400).json({ erro: "Data de destino invalida." });
      }

      let novoFim = null;
      if (evento.fim) {
        const duracaoMs = new Date(evento.fim).getTime() - new Date(evento.inicio).getTime();
        if (duracaoMs > 0) {
          novoFim = new Date(novoInicio.getTime() + duracaoMs);
        }
      }

      const actorId = asObjectId(user.id);

      const updated = await AgendaEvento.findByIdAndUpdate(
        evento._id,
        {
          inicio: novoInicio,
          fim: novoFim,
          atualizadoPor: actorId,
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .lean();

      await registrarAuditoria(req, {
        acao: "AGENDA_EVENTO_MOVIDO",
        entidade: "agenda_evento",
        entidadeId: evento._id,
        detalhes: {
          de: evento.inicio,
          para: novoInicio,
        },
      });

      return res.status(200).json({
        mensagem: "Agendamento movido com sucesso.",
        evento: mapEvento(updated),
      });
    } catch (error) {
      console.error("Erro ao mover evento de agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao mover agendamento." });
    }
  }

  static async alterarStatus(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_STATUS])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        return res.status(400).json({ erro: "Campo ativo e obrigatorio." });
      }

      const evento = await AgendaEvento.findById(req.params?.id);
      if (!evento) {
        return res.status(404).json({ erro: "Evento de agenda nao encontrado." });
      }

      if (!canMutateEvent(user, evento)) {
        return res.status(403).json({ erro: "Sem permissao para alterar este evento." });
      }

      const actorId = asObjectId(user.id);

      const updated = await AgendaEvento.findByIdAndUpdate(
        evento._id,
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
      )
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .lean();

      await registrarAuditoria(req, {
        acao: ativo ? "AGENDA_EVENTO_REATIVADO" : "AGENDA_EVENTO_INATIVADO",
        entidade: "agenda_evento",
        entidadeId: evento._id,
      });

      return res.status(200).json({
        mensagem: "Status do agendamento atualizado com sucesso.",
        evento: mapEvento(updated),
      });
    } catch (error) {
      console.error("Erro ao alterar status do evento de agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao alterar status do agendamento." });
    }
  }
}

module.exports = AgendaController;


