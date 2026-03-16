const Familia = require("../../schemas/social/Familia");
const Usuario = require("../../schemas/core/Usuario");
const { Paciente } = require("../../schemas/social/Paciente");
const {
  AgendaEvento,
  TIPOS_AGENDA,
  AGENDA_ROOM_REQUIRED_TYPES,
} = require("../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../schemas/social/AgendaSala");
const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { registrarAuditoria } = require("../../services/auditService");
const { hasAnyPermission } = require("../../services/accessControlService");
const {
  AGENDA_DEFAULT_DURATION_MINUTES,
  asObjectId,
  buildAgendaInterval,
  buildAnySalaConflictFilter,
  findSalaConflict,
  getEffectiveEnd,
  parseAgendaDate,
} = require("../../services/agendaAvailabilityService");

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

function canManageRooms(user) {
  return canViewAll(user);
}

function parseDateInput(value) {
  return parseAgendaDate(value);
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

function sanitizeSalaNome(value) {
  return String(value || "").trim().slice(0, 120);
}

function sanitizeSalaDescricao(value) {
  return String(value || "").trim().slice(0, 240);
}

function isProvided(value) {
  return typeof value !== "undefined" && value !== null && String(value).trim() !== "";
}

function isRoomRequiredForType(tipoAtendimento) {
  return AGENDA_ROOM_REQUIRED_TYPES.includes(String(tipoAtendimento || "").trim());
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
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

function mapSala(doc) {
  const sala = doc?.toObject ? doc.toObject() : doc;
  if (!sala) return null;

  return {
    _id: sala._id,
    nome: sala.nome || "",
    descricao: sala.descricao || "",
    ativo: sala.ativo !== false,
  };
}

function mapEvento(doc) {
  const evento = doc?.toObject ? doc.toObject() : doc;
  const inicio = evento?.inicio ? new Date(evento.inicio) : null;
  const fim = getEffectiveEnd(evento?.inicio, evento?.fim);

  return {
    _id: evento?._id,
    titulo: evento?.titulo || "",
    tipoAtendimento: evento?.tipoAtendimento || "outro",
    inicio: evento?.inicio,
    fim: fim || null,
    local: evento?.local || "",
    observacoes: evento?.observacoes || "",
    ativo: !!evento?.ativo,
    dia: inicio ? toDayDateString(inicio) : "",
    hora: inicio ? toTimeString(inicio) : "",
    sala: mapSala(evento?.salaId),
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

async function loadEventoById(eventoId) {
  return AgendaEvento.findById(eventoId)
    .populate("responsavelId", "_id nome perfil")
    .populate("familiaId", "_id responsavel endereco")
    .populate("pacienteId", "_id nome")
    .populate("salaId", "_id nome descricao ativo")
    .lean();
}

async function resolveSalaSelection({
  salaIdInput,
  tipoAtendimento,
  inicio,
  fim,
  ignoreEventId = null,
  allowEmptyRoom = false,
}) {
  const salaId = asObjectId(salaIdInput);
  if (isProvided(salaIdInput) && !salaId) {
    return { error: "Sala informada e invalida.", status: 400 };
  }

  if (!salaId) {
    if (isRoomRequiredForType(tipoAtendimento) && !allowEmptyRoom) {
      return { error: "Selecione uma sala de atendimento para este agendamento.", status: 400 };
    }
    return { salaId: null, sala: null };
  }

  const sala = await AgendaSala.findById(salaId).select("_id nome descricao ativo").lean();
  if (!sala || !sala.ativo) {
    return { error: "Sala informada esta inativa ou nao existe.", status: 400 };
  }

  const conflito = await findSalaConflict({
    salaId,
    inicio,
    fim,
    ignoreEventId,
  });

  if (conflito) {
    return {
      error: "A sala selecionada ja possui um agendamento neste horario.",
      status: 409,
      conflito,
    };
  }

  return { salaId, sala };
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
        .populate("salaId", "_id nome descricao ativo")
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

  static async listarSalas(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_VIEW])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const incluirInativas = canManageRooms(user) && parseBoolean(req.query?.incluirInativas) === true;
      const filtro = {};
      if (!incluirInativas) filtro.ativo = true;

      const salas = await AgendaSala.find(filtro).sort({ nome: 1 }).lean();
      return res.status(200).json({ salas: salas.map(mapSala) });
    } catch (error) {
      console.error("Erro ao listar salas da agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao listar salas." });
    }
  }

  static async listarSalasDisponiveis(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !hasAnyPermission(user.permissions || [], [PERMISSIONS.AGENDA_VIEW])) {
        return res.status(403).json({ erro: "Acesso negado para agenda." });
      }

      const inicio = parseDateInput(req.query?.inicio);
      const fim = parseDateInput(req.query?.fim);
      if (!inicio) {
        return res.status(400).json({ erro: "Informe o inicio para consultar as salas." });
      }

      const intervalo = buildAgendaInterval({ inicio, fim });
      if (!intervalo.inicio || !intervalo.fim || intervalo.fim <= intervalo.inicio) {
        return res.status(400).json({ erro: "Intervalo de consulta invalido." });
      }

      const salas = await AgendaSala.find({ ativo: true }).sort({ nome: 1 }).lean();
      if (!salas.length) {
        return res.status(200).json({
          inicio: intervalo.inicio,
          fim: intervalo.fim,
          salas: [],
        });
      }

      const filtroConflitos = buildAnySalaConflictFilter({
        inicio: intervalo.inicio,
        fim: intervalo.fim,
        ignoreEventId: req.query?.eventoId || null,
      });

      const salasOcupadas = filtroConflitos ? await AgendaEvento.distinct("salaId", filtroConflitos) : [];
      const salaOcupadaSet = new Set((salasOcupadas || []).map((item) => String(item || "")));
      const disponiveis = salas.filter((sala) => !salaOcupadaSet.has(String(sala._id)));

      return res.status(200).json({
        inicio: intervalo.inicio,
        fim: intervalo.fim,
        salas: disponiveis.map(mapSala),
      });
    } catch (error) {
      console.error("Erro ao listar salas disponiveis:", error);
      return res.status(500).json({ erro: "Erro interno ao consultar salas disponiveis." });
    }
  }

  static async criarSala(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !canManageRooms(user)) {
        return res.status(403).json({ erro: "Sem permissao para cadastrar salas." });
      }

      const actorId = asObjectId(user.id);
      const nome = sanitizeSalaNome(req.body?.nome);
      const descricao = sanitizeSalaDescricao(req.body?.descricao);

      if (!nome) {
        return res.status(400).json({ erro: "Nome da sala e obrigatorio." });
      }

      const sala = await AgendaSala.create({
        nome,
        descricao,
        ativo: true,
        criadoPor: actorId,
        atualizadoPor: actorId,
      });

      await registrarAuditoria(req, {
        acao: "AGENDA_SALA_CRIADA",
        entidade: "agenda_sala",
        entidadeId: sala._id,
      });

      return res.status(201).json({
        mensagem: "Sala criada com sucesso.",
        sala: mapSala(sala),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ erro: "Ja existe uma sala com esse nome." });
      }
      console.error("Erro ao criar sala da agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao criar sala." });
    }
  }

  static async atualizarSala(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !canManageRooms(user)) {
        return res.status(403).json({ erro: "Sem permissao para editar salas." });
      }

      const sala = await AgendaSala.findById(req.params?.id);
      if (!sala) {
        return res.status(404).json({ erro: "Sala nao encontrada." });
      }

      const nome = sanitizeSalaNome(req.body?.nome);
      const descricao = sanitizeSalaDescricao(req.body?.descricao);
      if (!nome) {
        return res.status(400).json({ erro: "Nome da sala e obrigatorio." });
      }

      sala.nome = nome;
      sala.descricao = descricao;
      sala.atualizadoPor = asObjectId(user.id);
      await sala.save();

      await registrarAuditoria(req, {
        acao: "AGENDA_SALA_ATUALIZADA",
        entidade: "agenda_sala",
        entidadeId: sala._id,
      });

      return res.status(200).json({
        mensagem: "Sala atualizada com sucesso.",
        sala: mapSala(sala),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ erro: "Ja existe uma sala com esse nome." });
      }
      console.error("Erro ao atualizar sala da agenda:", error);
      return res.status(500).json({ erro: "Erro interno ao atualizar sala." });
    }
  }

  static async alterarStatusSala(req, res) {
    try {
      const user = getSessionUser(req);
      if (!user || !canManageRooms(user)) {
        return res.status(403).json({ erro: "Sem permissao para alterar salas." });
      }

      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        return res.status(400).json({ erro: "Campo ativo e obrigatorio." });
      }

      const sala = await AgendaSala.findById(req.params?.id);
      if (!sala) {
        return res.status(404).json({ erro: "Sala nao encontrada." });
      }

      sala.ativo = ativo;
      sala.atualizadoPor = asObjectId(user.id);
      sala.inativadoEm = ativo ? null : new Date();
      sala.inativadoPor = ativo ? null : asObjectId(user.id);
      await sala.save();

      await registrarAuditoria(req, {
        acao: ativo ? "AGENDA_SALA_REATIVADA" : "AGENDA_SALA_INATIVADA",
        entidade: "agenda_sala",
        entidadeId: sala._id,
      });

      return res.status(200).json({
        mensagem: "Status da sala atualizado com sucesso.",
        sala: mapSala(sala),
      });
    } catch (error) {
      console.error("Erro ao alterar status da sala:", error);
      return res.status(500).json({ erro: "Erro interno ao alterar status da sala." });
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

      if (!TIPOS_AGENDA.includes(tipoAtendimento)) {
        return res.status(400).json({ erro: "Tipo de atendimento invalido." });
      }

      const intervalo = buildAgendaInterval({ inicio, fim });
      if (!intervalo.inicio || !intervalo.fim || intervalo.fim <= intervalo.inicio) {
        return res.status(400).json({ erro: "Data de fim deve ser maior que a data de inicio." });
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

      const salaSelection = await resolveSalaSelection({
        salaIdInput: req.body?.salaId || null,
        tipoAtendimento,
        inicio: intervalo.inicio,
        fim: intervalo.fim,
      });

      if (salaSelection.error) {
        return res.status(salaSelection.status || 400).json({ erro: salaSelection.error });
      }

      const evento = await AgendaEvento.create({
        titulo,
        tipoAtendimento,
        inicio: intervalo.inicio,
        fim: intervalo.fim,
        local,
        observacoes,
        salaId: salaSelection.salaId || null,
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
          salaId: salaSelection.salaId || null,
          duracaoMinutos: AGENDA_DEFAULT_DURATION_MINUTES,
        },
      });

      const loaded = await loadEventoById(evento._id);

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
      const rawNextFim = Object.prototype.hasOwnProperty.call(patch, "fim") ? patch.fim : evento.fim;
      const intervalo = buildAgendaInterval({ inicio: nextInicio, fim: rawNextFim });
      if (!intervalo.inicio || !intervalo.fim || intervalo.fim <= intervalo.inicio) {
        return res.status(400).json({ erro: "Data de fim deve ser maior que a data de inicio." });
      }

      patch.fim = intervalo.fim;

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

      const hasSala = Object.prototype.hasOwnProperty.call(req.body, "salaId");
      const nextTipoAtendimento = patch.tipoAtendimento || evento.tipoAtendimento;
      const nextSalaInput = hasSala ? req.body?.salaId || null : evento.salaId || null;
      const allowEmptyRoom =
        !hasSala &&
        !Object.prototype.hasOwnProperty.call(req.body, "tipoAtendimento") &&
        !asObjectId(evento.salaId);

      const salaSelection = await resolveSalaSelection({
        salaIdInput: nextSalaInput,
        tipoAtendimento: nextTipoAtendimento,
        inicio: intervalo.inicio,
        fim: intervalo.fim,
        ignoreEventId: evento._id,
        allowEmptyRoom,
      });

      if (salaSelection.error) {
        return res.status(salaSelection.status || 400).json({ erro: salaSelection.error });
      }

      patch.salaId = salaSelection.salaId || null;

      const updated = await AgendaEvento.findByIdAndUpdate(evento._id, patch, {
        new: true,
        runValidators: true,
      })
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .populate("salaId", "_id nome descricao ativo")
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

      if (!novoFim) {
        novoFim = getEffectiveEnd(novoInicio, null);
      }

      const salaSelection = await resolveSalaSelection({
        salaIdInput: evento.salaId || null,
        tipoAtendimento: evento.tipoAtendimento,
        inicio: novoInicio,
        fim: novoFim,
        ignoreEventId: evento._id,
        allowEmptyRoom: !asObjectId(evento.salaId),
      });

      if (salaSelection.error) {
        return res.status(salaSelection.status || 400).json({ erro: salaSelection.error });
      }

      const actorId = asObjectId(user.id);

      const updated = await AgendaEvento.findByIdAndUpdate(
        evento._id,
        {
          inicio: novoInicio,
          fim: novoFim,
          atualizadoPor: actorId,
          salaId: salaSelection.salaId || null,
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("responsavelId", "_id nome perfil")
        .populate("familiaId", "_id responsavel endereco")
        .populate("pacienteId", "_id nome")
        .populate("salaId", "_id nome descricao ativo")
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
        .populate("salaId", "_id nome descricao ativo")
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
