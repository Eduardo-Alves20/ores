const PRESENCA_LABELS = Object.freeze({
  pendente: "Pendente",
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  cancelado_antecipadamente: "Cancelado antecipadamente",
});

function buildPresenceStatusOptions() {
  return [
    { value: "todos", label: "Todos os status" },
    { value: "presente", label: "Somente presencas" },
    { value: "falta", label: "Somente faltas" },
    { value: "falta_justificada", label: "Somente justificadas" },
    { value: "pendente", label: "Somente pendentes" },
    { value: "cancelado_antecipadamente", label: "Somente cancelados" },
  ];
}

module.exports = {
  PRESENCA_LABELS,
  buildPresenceStatusOptions,
};
