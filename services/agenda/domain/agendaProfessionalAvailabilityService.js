const Usuario = require("../../../schemas/core/Usuario");
const { AgendaEvento, TIPOS_AGENDA } = require("../../../schemas/social/AgendaEvento");
const { AgendaSala } = require("../../../schemas/social/AgendaSala");
const { Paciente } = require("../../../schemas/social/Paciente");
const { PERFIS } = require("../../../config/roles");
const {
  AGENDA_DEFAULT_DURATION_MINUTES,
  asObjectId,
  buildAgendaInterval,
  buildAnySalaConflictFilter,
  getEffectiveEnd,
} = require("../../shared/agendaAvailabilityService");
const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { createAgendaError } = require("./agendaErrorService");
const { ensureAgendaPermission, PERMISSIONS } = require("./agendaEventMutationSupportService");
const { loadEventoById } = require("./agendaRelationService");
const { mapEvento } = require("./agendaMappingService");

const PROFESSIONAL_AVAILABILITY_ALLOWED_PROFILES = Object.freeze([
  PERFIS.SUPERADMIN,
  PERFIS.ADMIN,
  PERFIS.ATENDENTE,
  PERFIS.TECNICO,
  PERFIS.USUARIO,
]);

const FAMILY_BOOKING_DEFAULT_TYPE = TIPOS_AGENDA.includes("atendimento_sede")
  ? "atendimento_sede"
  : "outro";

const FAMILY_BOOKING_DEFAULT_LOCAL = "Instituto ORES";

function parseTimeToMinutes(value) {
  const raw = String(value || "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutesToTime(value) {
  const total = Number(value);
  if (!Number.isFinite(total) || total < 0) return "";
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function normalizeAvailabilityDay(item = {}) {
  const diaSemana = Number(item?.diaSemana);
  const inicio = String(item?.inicio || "").trim();
  const fim = String(item?.fim || "").trim();
  const inicioMinutos = parseTimeToMinutes(inicio);
  const fimMinutos = parseTimeToMinutes(fim);

  if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) return null;
  if (inicioMinutos === null || fimMinutos === null || fimMinutos <= inicioMinutos) {
    return null;
  }

  return {
    diaSemana,
    inicio,
    fim,
    ativo: item?.ativo !== false,
  };
}

function normalizeAvailabilityConfig(raw = {}) {
  const dias = Array.isArray(raw?.dias)
    ? raw.dias
        .map(normalizeAvailabilityDay)
        .filter(Boolean)
        .sort((left, right) => {
          if (left.diaSemana !== right.diaSemana) {
            return left.diaSemana - right.diaSemana;
          }
          return parseTimeToMinutes(left.inicio) - parseTimeToMinutes(right.inicio);
        })
    : [];

  return {
    ativo: raw?.ativo !== false && dias.length > 0,
    dias,
  };
}

function mapAvailabilityConfig(raw = {}) {
  const config = normalizeAvailabilityConfig(raw);
  return {
    ativo: config.ativo,
    dias: config.dias.map((item) => ({
      diaSemana: item.diaSemana,
      inicio: item.inicio,
      fim: item.fim,
      ativo: item.ativo !== false,
    })),
  };
}

function startOfWeek(referenceDate) {
  const base = new Date(referenceDate);
  if (Number.isNaN(base.getTime())) return null;
  const normalized = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    12,
    0,
    0,
    0
  );
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
}

function buildWeekReference(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return startOfWeek(new Date());
  }
  return startOfWeek(parsed);
}

function buildProfessionalEventConflictFilter({ profissionalId, inicio, fim }) {
  const profissionalObjectId = asObjectId(profissionalId);
  const intervalo = buildAgendaInterval({ inicio, fim });
  if (!profissionalObjectId || !intervalo.inicio || !intervalo.fim) return null;

  return {
    ativo: true,
    responsavelId: profissionalObjectId,
    statusAgendamento: { $ne: "cancelado" },
    $expr: {
      $and: [
        { $lt: ["$inicio", intervalo.fim] },
        {
          $gt: [
            {
              $ifNull: [
                "$fim",
                {
                  $dateAdd: {
                    startDate: "$inicio",
                    unit: "minute",
                    amount: AGENDA_DEFAULT_DURATION_MINUTES,
                  },
                },
              ],
            },
            intervalo.inicio,
          ],
        },
      ],
    },
  };
}

async function findFirstAvailableRoom({ inicio, fim }) {
  const salas = await AgendaSala.find({ ativo: true }).sort({ nome: 1 }).lean();
  if (!salas.length) {
    throw createAgendaError(
      409,
      "Nenhuma sala de atendimento esta disponivel para este horario."
    );
  }

  const filtroConflitos = buildAnySalaConflictFilter({ inicio, fim });
  const ocupadas = filtroConflitos
    ? await AgendaEvento.distinct("salaId", filtroConflitos)
    : [];
  const ocupadasSet = new Set((ocupadas || []).map((item) => String(item || "")));
  const salaLivre = salas.find((item) => !ocupadasSet.has(String(item._id)));

  if (!salaLivre?._id) {
    throw createAgendaError(
      409,
      "Nao ha salas livres para esse horario. Escolha outro horario."
    );
  }

  return salaLivre;
}

async function loadOwnAgendaAvailability(user) {
  ensureAgendaPermission(
    user,
    PERMISSIONS.AGENDA_VIEW,
    "Acesso negado para agenda."
  );

  const usuario = await Usuario.findById(user?.id)
    .select("_id nome agendaDisponibilidade")
    .lean();

  if (!usuario?._id) {
    throw createAgendaError(404, "Profissional nao encontrado.");
  }

  return {
    profissional: {
      _id: String(usuario._id),
      nome: usuario.nome || "",
    },
    disponibilidade: mapAvailabilityConfig(usuario?.agendaDisponibilidade || {}),
  };
}

async function updateOwnAgendaAvailability(user, body = {}) {
  ensureAgendaPermission(
    user,
    PERMISSIONS.AGENDA_VIEW,
    "Acesso negado para configurar disponibilidade."
  );

  const actorId = asObjectId(user?.id);
  if (!actorId) {
    throw createAgendaError(401, "Sessao invalida.");
  }

  const disponibilidade = normalizeAvailabilityConfig({
    ativo: body?.ativo !== false,
    dias: body?.dias,
  });

  const usuario = await Usuario.findByIdAndUpdate(
    actorId,
    {
      agendaDisponibilidade: {
        ativo: disponibilidade.ativo,
        dias: disponibilidade.dias,
        updatedAt: new Date(),
        updatedBy: actorId,
      },
      atualizadoPor: actorId,
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .select("_id nome agendaDisponibilidade")
    .lean();

  return {
    mensagem: "Disponibilidade de atendimento atualizada com sucesso.",
    profissional: {
      _id: String(usuario?._id || actorId),
      nome: usuario?.nome || user?.nome || "Profissional",
    },
    disponibilidade: mapAvailabilityConfig(usuario?.agendaDisponibilidade || {}),
  };
}

async function listProfessionalsWithAvailability() {
  const profissionais = await Usuario.find({
    ativo: true,
    perfil: { $in: PROFESSIONAL_AVAILABILITY_ALLOWED_PROFILES },
    tipoCadastro: { $ne: "familia" },
    "agendaDisponibilidade.ativo": true,
  })
    .select("_id nome perfil tipoCadastro nivelAcessoVoluntario agendaDisponibilidade")
    .sort({ nome: 1 })
    .lean();

  return profissionais
    .map((item) => ({
      _id: String(item._id),
      nome: item.nome || "Profissional",
      perfil: item.perfil || "",
      tipoCadastro: item.tipoCadastro || "",
      nivelAcessoVoluntario: item.nivelAcessoVoluntario || "",
      disponibilidade: mapAvailabilityConfig(item?.agendaDisponibilidade || {}),
    }))
    .filter((item) => item.disponibilidade.ativo && item.disponibilidade.dias.length);
}

async function buildProfessionalWeekSlots({ profissionalId, referencia }) {
  const profissionalObjectId = asObjectId(profissionalId);
  if (!profissionalObjectId) {
    throw createAgendaError(400, "Profissional invalido para consulta de horarios.");
  }

  const profissional = await Usuario.findById(profissionalObjectId)
    .select("_id nome agendaDisponibilidade ativo")
    .lean();

  if (!profissional?._id || profissional.ativo === false) {
    throw createAgendaError(404, "Profissional nao encontrado.");
  }

  const disponibilidade = normalizeAvailabilityConfig(
    profissional?.agendaDisponibilidade || {}
  );
  if (!disponibilidade.ativo || !disponibilidade.dias.length) {
    return {
      profissional: {
        _id: String(profissional._id),
        nome: profissional.nome || "Profissional",
      },
      referencia: buildWeekReference(referencia)?.toISOString() || new Date().toISOString(),
      dias: [],
    };
  }

  const weekStart = buildWeekReference(referencia);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const now = new Date();

  const eventRangeStart = new Date(weekStart);
  eventRangeStart.setHours(0, 0, 0, 0);
  const eventRangeEnd = new Date(weekEnd);
  eventRangeEnd.setHours(23, 59, 59, 999);

  const [eventosProfissional, eventosComSala, salas] = await Promise.all([
    AgendaEvento.find({
      ativo: true,
      responsavelId: profissional._id,
      statusAgendamento: { $ne: "cancelado" },
      inicio: {
        $gte: eventRangeStart,
        $lte: eventRangeEnd,
      },
    })
      .select("_id inicio fim")
      .lean(),
    AgendaEvento.find({
      ativo: true,
      salaId: { $ne: null },
      statusAgendamento: { $ne: "cancelado" },
      inicio: {
        $gte: eventRangeStart,
        $lte: eventRangeEnd,
      },
    })
      .select("_id inicio fim salaId")
      .lean(),
    AgendaSala.find({ ativo: true }).select("_id nome").lean(),
  ]);

  const dias = [];

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);
    current.setHours(0, 0, 0, 0);
    const diaSemana = current.getDay();
    const regras = disponibilidade.dias.filter(
      (item) => item.ativo !== false && item.diaSemana === diaSemana
    );

    const slots = [];

    regras.forEach((regra) => {
      const inicioMinutos = parseTimeToMinutes(regra.inicio);
      const fimMinutos = parseTimeToMinutes(regra.fim);
      if (inicioMinutos === null || fimMinutos === null) return;

      for (
        let minuteCursor = inicioMinutos;
        minuteCursor + AGENDA_DEFAULT_DURATION_MINUTES <= fimMinutos;
        minuteCursor += AGENDA_DEFAULT_DURATION_MINUTES
      ) {
        const slotStart = new Date(current);
        slotStart.setHours(
          Math.floor(minuteCursor / 60),
          minuteCursor % 60,
          0,
          0
        );
        const slotEnd = getEffectiveEnd(slotStart, null);
        if (!slotEnd || slotStart < now) continue;

        const hasProfessionalConflict = eventosProfissional.some((evento) => {
          const eventoInicio = new Date(evento?.inicio || 0);
          const eventoFim = getEffectiveEnd(evento?.inicio, evento?.fim);
          if (Number.isNaN(eventoInicio.getTime()) || !eventoFim) return false;
          return eventoInicio < slotEnd && eventoFim > slotStart;
        });
        if (hasProfessionalConflict) continue;

        const freeRooms = salas.filter((sala) => {
          const salaId = String(sala?._id || "");
          return !eventosComSala.some((evento) => {
            const eventoInicio = new Date(evento?.inicio || 0);
            const eventoFim = getEffectiveEnd(evento?.inicio, evento?.fim);
            if (!salaId || String(evento?.salaId || "") !== salaId) return false;
            if (Number.isNaN(eventoInicio.getTime()) || !eventoFim) return false;
            return eventoInicio < slotEnd && eventoFim > slotStart;
          });
        }).length;

        if (!freeRooms) continue;

        slots.push({
          inicio: slotStart.toISOString(),
          fim: slotEnd.toISOString(),
          label: toDateTimeLabel(slotStart),
          horaLabel: formatMinutesToTime(minuteCursor),
          freeRooms,
        });
      }
    });

    if (slots.length) {
      dias.push({
        data: current.toISOString(),
        label: new Intl.DateTimeFormat("pt-BR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
        }).format(current),
        slots: slots.map((item) => ({
          inicio: item.inicio,
          fim: item.fim,
          label: item.label,
          horaLabel: item.horaLabel,
          freeRooms: item.freeRooms,
        })),
      });
    }
  }

  return {
    profissional: {
      _id: String(profissional._id),
      nome: profissional.nome || "Profissional",
    },
    disponibilidade: mapAvailabilityConfig(disponibilidade),
    referencia: weekStart.toISOString(),
    dias: dias.filter((item) => item.slots.length),
  };
}

async function createFamilyScheduledAppointment(context = {}, body = {}) {
  const familiaId = asObjectId(context?.familia?._id);
  const actorId = asObjectId(context?.userId || context?.usuario?._id);
  const profissionalId = asObjectId(body?.profissionalId);
  const pacienteId = asObjectId(body?.pacienteId);
  const slotInicio = body?.slotInicio ? new Date(body.slotInicio) : null;

  if (!familiaId || !actorId) {
    throw createAgendaError(403, "Familia nao vinculada para este agendamento.");
  }
  if (!profissionalId) {
    throw createAgendaError(400, "Selecione o profissional.");
  }
  if (!pacienteId) {
    throw createAgendaError(400, "Selecione o dependente.");
  }
  if (!slotInicio || Number.isNaN(slotInicio.getTime()) || slotInicio <= new Date()) {
    throw createAgendaError(400, "Selecione um horario futuro valido.");
  }

  const paciente = await Paciente.findOne({
    _id: pacienteId,
    familiaId,
    ativo: true,
  })
    .select("_id nome familiaId")
    .lean();

  if (!paciente?._id) {
    throw createAgendaError(404, "Dependente nao encontrado para esta familia.");
  }

  const disponibilidade = await buildProfessionalWeekSlots({
    profissionalId,
    referencia: slotInicio,
  });

  const slot = (disponibilidade?.dias || [])
    .flatMap((item) => item.slots || [])
    .find((item) => String(item?.inicio || "") === slotInicio.toISOString());

  if (!slot?.inicio) {
    throw createAgendaError(
      409,
      "Esse horario nao esta mais disponivel. Escolha outro horario."
    );
  }

  const inicio = new Date(slot.inicio);
  const fim = slot.fim ? new Date(slot.fim) : getEffectiveEnd(inicio, null);
  const professionalConflictFilter = buildProfessionalEventConflictFilter({
    profissionalId,
    inicio,
    fim,
  });
  const existingConflict = professionalConflictFilter
    ? await AgendaEvento.findOne(professionalConflictFilter).select("_id inicio").lean()
    : null;
  if (existingConflict?._id) {
    throw createAgendaError(
      409,
      "Esse horario acabou de ser ocupado. Escolha outro horario."
    );
  }

  const sala = await findFirstAvailableRoom({ inicio, fim });
  const titulo = `Consulta ${disponibilidade?.profissional?.nome || "profissional"} - ${paciente.nome}`;

  const evento = await AgendaEvento.create({
    titulo,
    tipoAtendimento: FAMILY_BOOKING_DEFAULT_TYPE,
    inicio,
    fim,
    local: FAMILY_BOOKING_DEFAULT_LOCAL,
    observacoes: "Consulta agendada pela familia no portal.",
    salaId: sala?._id || null,
    familiaId,
    pacienteId,
    responsavelId: profissionalId,
    ativo: true,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  const loaded = await loadEventoById(evento._id);

  return {
    mensagem: "Consulta agendada com sucesso.",
    evento: mapEvento(loaded),
    audit: {
      acao: "AGENDA_EVENTO_CRIADO_PORTAL_FAMILIA",
      entidade: "agenda_evento",
      entidadeId: evento._id,
      detalhes: {
        origem: "portal_familia",
        responsavelId: profissionalId,
        familiaId,
        pacienteId,
        salaId: sala?._id || null,
      },
    },
    history: {
      eventoId: evento._id,
      tipo: "agendamento_criado",
      visibilidade: "todos",
      titulo: "Agendamento criado pela familia",
      descricao: `A familia agendou "${titulo}" para ${toDateTimeLabel(inicio)}.`,
      detalhes: {
        origem: "portal_familia",
        responsavelId: profissionalId,
        familiaId,
        pacienteId,
        salaId: sala?._id || null,
      },
      ator: {
        id: actorId,
        _id: actorId,
        nome:
          String(context?.usuario?.nome || "").trim() ||
          String(context?.familia?.responsavel?.nome || "").trim() ||
          "Familia",
        perfil: "usuario",
      },
    },
    notify: {
      type: "event_created",
      event: loaded,
      audience: "all",
      origin: "portal_familia",
    },
  };
}

module.exports = {
  AGENDA_DEFAULT_DURATION_MINUTES,
  buildProfessionalWeekSlots,
  createFamilyScheduledAppointment,
  listProfessionalsWithAvailability,
  loadOwnAgendaAvailability,
  mapAvailabilityConfig,
  normalizeAvailabilityConfig,
  parseTimeToMinutes,
  updateOwnAgendaAvailability,
};
