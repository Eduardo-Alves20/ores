const ADDRESS_FIELDS = Object.freeze([
  ["cep", 20],
  ["rua", 160],
  ["numero", 20],
  ["bairro", 80],
  ["cidade", 80],
  ["estado", 2],
  ["complemento", 120],
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeLimitedString(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeFamilyResponsible(value = {}) {
  const input = isPlainObject(value) ? value : {};

  return {
    nome: normalizeLimitedString(input.nome, 120),
    telefone: normalizeLimitedString(input.telefone, 30),
    email: normalizeLimitedString(input.email, 140).toLowerCase(),
    parentesco: normalizeLimitedString(input.parentesco, 60) || "responsavel",
  };
}

function normalizeFamilyAddress(value = {}) {
  const input = isPlainObject(value) ? value : {};
  const output = {};

  ADDRESS_FIELDS.forEach(([key, maxLength]) => {
    const normalized = normalizeLimitedString(input[key], maxLength);
    if (normalized) {
      output[key] = key === "estado" ? normalized.toUpperCase() : normalized;
    }
  });

  return output;
}

function normalizeFamilyObservacoes(value) {
  return normalizeLimitedString(value, 3000);
}

module.exports = {
  ADDRESS_FIELDS,
  isPlainObject,
  normalizeFamilyAddress,
  normalizeFamilyObservacoes,
  normalizeFamilyResponsible,
  normalizeLimitedString,
};
