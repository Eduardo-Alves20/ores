const mongoose = require("mongoose");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");

const AGENDA_DEFAULT_DURATION_MINUTES = 30;

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function parseAgendaDate(value) {
  if (!value) return null;
  const dt = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function addMinutes(dateLike, minutes = AGENDA_DEFAULT_DURATION_MINUTES) {
  const dt = parseAgendaDate(dateLike);
  if (!dt) return null;
  return new Date(dt.getTime() + minutes * 60 * 1000);
}

function getEffectiveEnd(inicio, fim) {
  const inicioDate = parseAgendaDate(inicio);
  if (!inicioDate) return null;

  const fimDate = parseAgendaDate(fim);
  if (fimDate && fimDate > inicioDate) {
    return fimDate;
  }

  return addMinutes(inicioDate, AGENDA_DEFAULT_DURATION_MINUTES);
}

function buildAgendaInterval({ inicio, fim }) {
  const inicioDate = parseAgendaDate(inicio);
  if (!inicioDate) return { inicio: null, fim: null };

  const fimDate = getEffectiveEnd(inicioDate, fim);
  return {
    inicio: inicioDate,
    fim: fimDate,
  };
}

function buildSalaConflictFilter({ salaId, inicio, fim, ignoreEventId = null }) {
  const intervalo = buildAgendaInterval({ inicio, fim });
  if (!intervalo.inicio || !intervalo.fim) {
    return null;
  }

  const expr = {
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

  return expr;
}

function buildAnySalaConflictFilter({ inicio, fim, ignoreEventId = null }) {
  const baseExpr = buildSalaConflictFilter({ salaId: new mongoose.Types.ObjectId(), inicio, fim, ignoreEventId });
  if (!baseExpr) return null;

  const filtro = {
    ativo: true,
    salaId: { $ne: null },
    $expr: baseExpr.$expr,
  };

  const ignoreId = asObjectId(ignoreEventId);
  if (ignoreId) {
    filtro._id = { $ne: ignoreId };
  }

  return filtro;
}

function buildSalaSpecificConflictFilter({ salaId, inicio, fim, ignoreEventId = null }) {
  const salaObjectId = asObjectId(salaId);
  const filtro = buildAnySalaConflictFilter({ inicio, fim, ignoreEventId });
  if (!salaObjectId || !filtro) return null;

  filtro.salaId = salaObjectId;
  return filtro;
}

async function findSalaConflict({ salaId, inicio, fim, ignoreEventId = null }) {
  const filtro = buildSalaSpecificConflictFilter({ salaId, inicio, fim, ignoreEventId });
  if (!filtro) return null;

  return AgendaEvento.findOne(filtro)
    .select("_id titulo inicio fim salaId")
    .populate("salaId", "_id nome")
    .lean();
}

module.exports = {
  AGENDA_DEFAULT_DURATION_MINUTES,
  addMinutes,
  asObjectId,
  buildAnySalaConflictFilter,
  buildAgendaInterval,
  buildSalaConflictFilter,
  buildSalaSpecificConflictFilter,
  findSalaConflict,
  getEffectiveEnd,
  parseAgendaDate,
};
