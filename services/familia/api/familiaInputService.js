const ADDRESS_FIELDS = Object.freeze([
  ["cep", 20],
  ["rua", 160],
  ["numero", 20],
  ["bairro", 80],
  ["cidade", 80],
  ["estado", 2],
  ["complemento", 120],
]);

const FORM_TO_RESPONSAVEL_FIELDS = Object.freeze({
  responsavel_nome: "nome",
  responsavel_telefone: "telefone",
  responsavel_email: "email",
  responsavel_parentesco: "parentesco",
  responsavel_familiar_nome: "nomeResponsavel",
  responsavel_familiar_cpf: "cpfResponsavel",
  responsavel_familiar_nascimento: "dataNascimentoResponsavel",
  responsavel_familiar_telefone: "telefoneResponsavel",
  responsavel_familiar_email: "emailResponsavel",
});

const FORM_TO_ENDERECO_FIELDS = Object.freeze({
  endereco_cep: "cep",
  endereco_rua: "rua",
  endereco_numero: "numero",
  endereco_bairro: "bairro",
  endereco_cidade: "cidade",
  endereco_estado: "estado",
  endereco_complemento: "complemento",
});

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

function isNotFutureIsoDate(value) {
  if (!isIsoDate(value)) return false;
  const normalized = normalizeLimitedString(value, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() <= today.getTime();
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
      : key === "numero"
        ? normalizeDigits(input[key], 10)
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

function normalizeFamilyExtraFields(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const output = {};

  Object.entries(source).forEach(([rawKey, rawValue]) => {
    const key = normalizeLimitedString(rawKey, 120)
      .replace(/[^a-zA-Z0-9_]/g, "");
    if (!key) return;

    if (typeof rawValue === "boolean") {
      output[key] = rawValue;
      return;
    }

    if (Number.isFinite(rawValue)) {
      output[key] = rawValue;
      return;
    }

    if (rawValue && typeof rawValue === "object") {
      return;
    }

    const normalized = normalizeLimitedString(rawValue, 5000);
    if (!normalized) return;
    output[key] = normalized;
  });

  return output;
}

function normalizeFieldFromForm(value, maxLength = 5000) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeLimitedString(item, maxLength))
      .filter(Boolean)
      .join(",");
  }

  if (value && typeof value === "object") {
    return "";
  }

  return normalizeLimitedString(value, maxLength);
}

function mapFamilyFormBodyToPayload(body = {}) {
  const source = isPlainObject(body) ? body : {};
  const responsavel = {};
  const endereco = {};
  const rawCamposExtras = {};

  Object.entries(FORM_TO_RESPONSAVEL_FIELDS).forEach(([formField, payloadField]) => {
    if (!Object.prototype.hasOwnProperty.call(source, formField)) return;
    responsavel[payloadField] = source[formField];
  });

  Object.entries(FORM_TO_ENDERECO_FIELDS).forEach(([formField, payloadField]) => {
    if (!Object.prototype.hasOwnProperty.call(source, formField)) return;
    endereco[payloadField] = source[formField];
  });

  Object.entries(source).forEach(([rawKey, rawValue]) => {
    if (!rawKey.startsWith("campoExtra_")) return;
    const extraKey = normalizeLimitedString(rawKey.slice("campoExtra_".length), 120)
      .replace(/[^a-zA-Z0-9_]/g, "");
    if (!extraKey) return;

    const normalizedValue = normalizeFieldFromForm(rawValue, 5000);
    rawCamposExtras[extraKey] = normalizedValue;
  });

  return {
    responsavel: normalizeFamilyResponsible(responsavel),
    endereco: normalizeFamilyAddress(endereco),
    observacoes: normalizeFamilyObservacoes(source.observacoes),
    camposExtras: normalizeFamilyExtraFields(rawCamposExtras),
    ativo: source.ativo,
  };
}

module.exports = {
  ADDRESS_FIELDS,
  countDigits,
  isPlainObject,
  isValidCep,
  isValidCpf,
  isValidPhone,
  isIsoDate,
  isNotFutureIsoDate,
  normalizeFamilyAddress,
  normalizeFamilyExtraFields,
  mapFamilyFormBodyToPayload,
  normalizeFamilyObservacoes,
  normalizeFamilyResponsible,
  normalizeLimitedString,
};
