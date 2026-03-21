const { toDateTimeLabel } = require("../../shared/dateFormattingService");
const { PRESENCA_LABELS } = require("./presenceConstants");
const { getWeekStart, toDateInputValue, toWeekLabel } = require("./presenceDateService");
const { getMostFrequentLabel, toPercent } = require("./presenceMetricHelpers");

function buildWeeklyRows(events) {
  const buckets = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const weekStart = getWeekStart(evento?.inicio);
    if (!weekStart) return;

    const key = weekStart.toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: toWeekLabel(weekStart),
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
        pendentes: 0,
        cancelados: 0,
        assistidoAusencias: new Map(),
      });
    }

    const row = buckets.get(key);
    row.total += 1;

    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") row.presentes += 1;
    else if (status === "falta") row.faltas += 1;
    else if (status === "falta_justificada") row.justificadas += 1;
    else if (status === "cancelado_antecipadamente") row.cancelados += 1;
    else row.pendentes += 1;

    if (["falta", "falta_justificada"].includes(status)) {
      const assistidoNome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";
      row.assistidoAusencias.set(
        assistidoNome,
        Number(row.assistidoAusencias.get(assistidoNome) || 0) + 1
      );
    }
  });

  return Array.from(buckets.values())
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))
    .map((row) => {
      const totalAusencias = Number(row.faltas || 0) + Number(row.justificadas || 0);
      const assistidoCriticoNome = getMostFrequentLabel(row.assistidoAusencias, "Sem recorrencia");

      return {
        ...row,
        totalAusencias,
        taxaComparecimento: toPercent(row.presentes, row.total),
        taxaAusencia: toPercent(totalAusencias, row.total),
        assistidoCriticoNome,
        assistidoCriticoQtd: Number(row.assistidoAusencias.get(assistidoCriticoNome) || 0),
      };
    });
}

function buildAssistidoRows(events) {
  const rows = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const pacienteId = String(evento?.pacienteId?._id || "");
    const familiaId = String(evento?.familiaId?._id || "");
    const key = pacienteId || familiaId || `evento:${String(evento?._id || "")}`;
    const nome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";
    const familiaNome = evento?.familiaId?.responsavel?.nome || "-";
    const profissionalNome = evento?.responsavelId?.nome || "Sem responsavel";
    const status = String(evento?.statusPresenca || "pendente").trim();
    const timestamp = new Date(evento?.inicio || 0).getTime();

    if (!rows.has(key)) {
      rows.set(key, {
        key,
        nome,
        familiaId,
        familiaNome,
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
        pendentes: 0,
        cancelados: 0,
        ultimaOcorrencia: null,
        ultimoStatus: "pendente",
        ultimoTimestamp: 0,
        ultimaAusencia: null,
        profissionaisMap: new Map(),
        timeline: [],
      });
    }

    const row = rows.get(key);
    row.total += 1;
    row.profissionaisMap.set(profissionalNome, Number(row.profissionaisMap.get(profissionalNome) || 0) + 1);
    row.timeline.push({ timestamp, status });

    if (timestamp >= row.ultimoTimestamp) {
      row.ultimoTimestamp = timestamp;
      row.ultimaOcorrencia = evento?.inicio || null;
      row.ultimoStatus = status;
    }

    if (["falta", "falta_justificada"].includes(status) && timestamp >= new Date(row.ultimaAusencia || 0).getTime()) {
      row.ultimaAusencia = evento?.inicio || null;
    }

    if (status === "presente") row.presentes += 1;
    else if (status === "falta") row.faltas += 1;
    else if (status === "falta_justificada") row.justificadas += 1;
    else if (status === "cancelado_antecipadamente") row.cancelados += 1;
    else row.pendentes += 1;
  });

  return Array.from(rows.values())
    .map((row) => {
      const timeline = [...row.timeline].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      let sequenciaAusencias = 0;

      for (const item of timeline) {
        if (["falta", "falta_justificada"].includes(String(item?.status || ""))) {
          sequenciaAusencias += 1;
          continue;
        }
        break;
      }

      const totalAusencias = Number(row.faltas || 0) + Number(row.justificadas || 0);

      return {
        ...row,
        totalAusencias,
        profissionalPrincipal: getMostFrequentLabel(row.profissionaisMap, "-"),
        taxaComparecimento: toPercent(row.presentes, row.total),
        taxaAusencia: toPercent(totalAusencias, row.total),
        sequenciaAusencias,
        ultimaOcorrenciaLabel: row.ultimaOcorrencia ? toDateTimeLabel(row.ultimaOcorrencia) : "-",
        ultimaAusenciaLabel: row.ultimaAusencia ? toDateTimeLabel(row.ultimaAusencia) : "-",
        ultimoStatusLabel: PRESENCA_LABELS[row.ultimoStatus || "pendente"] || "Pendente",
      };
    })
    .sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });
}

function buildProfissionalRows(events) {
  const rows = new Map();

  (Array.isArray(events) ? events : []).forEach((evento) => {
    const key = String(evento?.responsavelId?._id || "sem-responsavel");
    const nome = evento?.responsavelId?.nome || "Sem responsavel";
    const status = String(evento?.statusPresenca || "pendente").trim();
    const timestamp = new Date(evento?.inicio || 0).getTime();
    const assistidoNome = evento?.pacienteId?.nome || evento?.familiaId?.responsavel?.nome || "Sem vinculo";

    if (!rows.has(key)) {
      rows.set(key, {
        key,
        nome,
        total: 0,
        presentes: 0,
        faltas: 0,
        justificadas: 0,
        pendentes: 0,
        cancelados: 0,
        ultimaOcorrencia: null,
        ultimoTimestamp: 0,
        assistidoAusencias: new Map(),
      });
    }

    const row = rows.get(key);
    row.total += 1;

    if (timestamp >= row.ultimoTimestamp) {
      row.ultimoTimestamp = timestamp;
      row.ultimaOcorrencia = evento?.inicio || null;
    }

    if (status === "presente") row.presentes += 1;
    else if (status === "falta") row.faltas += 1;
    else if (status === "falta_justificada") row.justificadas += 1;
    else if (status === "cancelado_antecipadamente") row.cancelados += 1;
    else row.pendentes += 1;

    if (["falta", "falta_justificada"].includes(status)) {
      row.assistidoAusencias.set(
        assistidoNome,
        Number(row.assistidoAusencias.get(assistidoNome) || 0) + 1
      );
    }
  });

  return Array.from(rows.values())
    .map((row) => {
      const totalAusencias = Number(row.faltas || 0) + Number(row.justificadas || 0);
      const assistidoCritico = getMostFrequentLabel(row.assistidoAusencias, "Sem recorrencia");
      return {
        ...row,
        totalAusencias,
        taxaComparecimento: toPercent(row.presentes, row.total),
        taxaAusencia: toPercent(totalAusencias, row.total),
        assistidoCritico,
        assistidoCriticoQtd: Number(row.assistidoAusencias.get(assistidoCritico) || 0),
        ultimaOcorrenciaLabel: row.ultimaOcorrencia ? toDateTimeLabel(row.ultimaOcorrencia) : "-",
      };
    })
    .sort((a, b) => {
      if (b.faltas !== a.faltas) return b.faltas - a.faltas;
      if (b.justificadas !== a.justificadas) return b.justificadas - a.justificadas;
      return b.total - a.total;
    });
}

function buildOccurrenceRows(events) {
  return (Array.isArray(events) ? events : [])
    .slice()
    .sort((a, b) => new Date(b?.inicio || 0).getTime() - new Date(a?.inicio || 0).getTime())
    .map((evento) => {
      const statusPresenca = String(evento?.statusPresenca || "pendente").trim();
      return {
        id: String(evento?._id || ""),
        dataHoraLabel: toDateTimeLabel(evento?.inicio),
        dia: toDateInputValue(evento?.inicio),
        pacienteNome: evento?.pacienteId?.nome || "-",
        familiaId: String(evento?.familiaId?._id || ""),
        familiaNome: evento?.familiaId?.responsavel?.nome || "-",
        profissionalNome: evento?.responsavelId?.nome || "-",
        salaNome: evento?.salaId?.nome || "-",
        statusPresenca,
        statusPresencaLabel: PRESENCA_LABELS[statusPresenca] || "Pendente",
        observacao: String(evento?.presencaObservacao || evento?.observacoes || "").trim(),
        hasObservacao: Boolean(String(evento?.presencaObservacao || evento?.observacoes || "").trim()),
        titulo: evento?.titulo || "Agendamento",
      };
    });
}

module.exports = {
  buildWeeklyRows,
  buildAssistidoRows,
  buildProfissionalRows,
  buildOccurrenceRows,
};
