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
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeDigits(value, maxLength) {
  return String(value || "")
    .replace(/\D+/g, "")
    .slice(0, maxLength);
}

function countDigits(value) {
  return normalizeDigits(value, 32).length;
}

function formatCpf(value) {
  const digits = normalizeDigits(value, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatCep(value) {
  const digits = normalizeDigits(value, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatPhone(value) {
  const digits = normalizeDigits(value, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function normalizeEmail(value) {
  const normalized = normalizeLimitedString(value, 140).toLowerCase();
  if (!normalized) return "";
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRx.test(normalized) ? normalized : "";
}

function isValidPhone(value) {
  const total = countDigits(value);
  return total === 10 || total === 11;
}

function isValidCpf(value) {
  return countDigits(value) === 11;
}

function isValidCep(value) {
  return countDigits(value) === 8;
}

function isIsoDate(value) {
  const normalized = normalizeLimitedString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized);
}

function normalizeFamilyResponsible(value = {}) {
  const input = isPlainObject(value) ? value : {};

  return {
    nome: normalizeLimitedString(input.nome, 120),
    telefone: formatPhone(input.telefone),
    email: normalizeEmail(input.email),
    parentesco: normalizeLimitedString(input.parentesco, 60) || "responsavel",
    nomeResponsavel: normalizeLimitedString(input.nomeResponsavel, 120),
    cpfResponsavel: formatCpf(input.cpfResponsavel),
    dataNascimentoResponsavel: normalizeLimitedString(input.dataNascimentoResponsavel, 10),
    telefoneResponsavel: formatPhone(input.telefoneResponsavel),
    emailResponsavel: normalizeEmail(input.emailResponsavel),
  };
}

function normalizeFamilyAddress(value = {}) {
  const input = isPlainObject(value) ? value : {};
  const output = {};

  ADDRESS_FIELDS.forEach(([key, maxLength]) => {
    const normalized = key === "cep"
      ? formatCep(input[key])
      : normalizeLimitedString(input[key], maxLength);
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
  countDigits,
  isPlainObject,
  isValidCep,
  isValidCpf,
  isValidPhone,
  isIsoDate,
  normalizeFamilyAddress,
  normalizeFamilyObservacoes,
  normalizeFamilyResponsible,
  normalizeLimitedString,
};
