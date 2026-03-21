function buildPresenceCounters(events) {
  const counters = {
    total: 0,
    presente: 0,
    falta: 0,
    faltaJustificada: 0,
    pendente: 0,
    cancelado: 0,
  };

  (Array.isArray(events) ? events : []).forEach((evento) => {
    counters.total += 1;
    const status = String(evento?.statusPresenca || "pendente").trim();
    if (status === "presente") {
      counters.presente += 1;
    } else if (status === "falta") {
      counters.falta += 1;
    } else if (status === "falta_justificada") {
      counters.faltaJustificada += 1;
    } else if (status === "cancelado_antecipadamente") {
      counters.cancelado += 1;
    } else {
      counters.pendente += 1;
    }
  });

  return counters;
}

function toPercent(part, total) {
  const normalizedTotal = Number(total || 0);
  if (normalizedTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(part || 0) / normalizedTotal) * 100)));
}

function getMostFrequentLabel(counterMap, fallback = "-") {
  if (!(counterMap instanceof Map) || counterMap.size === 0) return fallback;

  let topLabel = fallback;
  let topCount = -1;

  counterMap.forEach((count, label) => {
    if (Number(count || 0) > topCount) {
      topCount = Number(count || 0);
      topLabel = label;
    }
  });

  return topLabel || fallback;
}

module.exports = {
  buildPresenceCounters,
  toPercent,
  getMostFrequentLabel,
};
