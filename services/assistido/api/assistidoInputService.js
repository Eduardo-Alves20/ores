const { createAssistidoError } = require("./assistidoContextService");
const {
  FAIXA_ETARIA,
  STATUS_CADASTRO,
  SEXO_BIOLOGICO,
  COR_RACA,
  PERMISSAO_CONTATO,
} = require("../../../schemas/social/Assistido");

// ── Validadores primitivos ──────────────────────────────────────────────────

function isValidCpf(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === Number(digits[10]);
}

function isValidCep(value) {
  return /^\d{8}$/.test(String(value || "").replace(/\D/g, ""));
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function isIsoDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function isNotFutureDate(value) {
  const d = new Date(value);
  return d <= new Date();
}

function stripToDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// ── Campos da etapa 1: dados pessoais ─────────────────────────────────────

function normalizeDadosPessoais(body = {}) {
  const nome = String(body.nome || "").trim();
  if (!nome) throw createAssistidoError("Nome é obrigatório.", 400);

  const cpfRaw = stripToDigits(body.cpf);
  if (cpfRaw && !isValidCpf(cpfRaw)) {
    throw createAssistidoError("CPF inválido.", 400);
  }

  let dataNascimento = null;
  if (body.dataNascimento) {
    if (!isIsoDate(body.dataNascimento)) {
      throw createAssistidoError("Data de nascimento inválida.", 400);
    }
    if (!isNotFutureDate(body.dataNascimento)) {
      throw createAssistidoError("Data de nascimento não pode ser futura.", 400);
    }
    dataNascimento = new Date(body.dataNascimento);
  }

  const sexoBiologico = body.sexoBiologico || null;
  if (sexoBiologico && !SEXO_BIOLOGICO.includes(sexoBiologico)) {
    throw createAssistidoError("Sexo biológico inválido.", 400);
  }

  const corRaca = body.corRaca || null;
  if (corRaca && !COR_RACA.includes(corRaca)) {
    throw createAssistidoError("Cor/raça inválida.", 400);
  }

  const permissaoContato = body.permissaoContato || null;
  if (permissaoContato && !PERMISSAO_CONTATO.includes(permissaoContato)) {
    throw createAssistidoError("Permissão de contato inválida.", 400);
  }

  const telefonePrincipal = String(body.telefonePrincipal || "").trim();
  if (telefonePrincipal && !isValidPhone(telefonePrincipal)) {
    throw createAssistidoError("Telefone principal inválido.", 400);
  }

  const responsavel = normalizeResponsavel(body.responsavel || {});
  const contatoEmergencia = normalizeContatoEmergencia(body.contatoEmergencia || {});

  return {
    nome,
    cpf: cpfRaw || null,
    rg: String(body.rg || "").trim() || null,
    orgaoEmissor: String(body.orgaoEmissor || "").trim() || null,
    dataNascimento,
    faixaEtaria: calcularFaixaEtaria(dataNascimento),
    sexoBiologico,
    corRaca,
    naturalidade: String(body.naturalidade || "").trim() || null,
    nacionalidade: String(body.nacionalidade || "Brasileira").trim(),
    telefonePrincipal: telefonePrincipal || null,
    telefoneSecundario: String(body.telefoneSecundario || "").trim() || null,
    isWhatsApp: typeof body.isWhatsApp === "boolean" ? body.isWhatsApp : null,
    email: String(body.email || "").trim().toLowerCase() || null,
    permissaoContato,
    responsavel,
    contatoEmergencia,
    diagnosticoResumo: String(body.diagnosticoResumo || "").trim() || null,
    observacoes: String(body.observacoes || "").trim() || null,
  };
}

function normalizeResponsavel(raw = {}) {
  const cpfRaw = stripToDigits(raw.cpf);
  if (cpfRaw && !isValidCpf(cpfRaw)) {
    throw createAssistidoError("CPF do responsável inválido.", 400);
  }

  let dataNascimento = null;
  if (raw.dataNascimento) {
    if (!isIsoDate(raw.dataNascimento)) {
      throw createAssistidoError("Data de nascimento do responsável inválida.", 400);
    }
    dataNascimento = new Date(raw.dataNascimento);
  }

  return {
    parentesco: String(raw.parentesco || "").trim() || null,
    nome: String(raw.nome || "").trim() || null,
    cpf: cpfRaw || null,
    dataNascimento,
    telefone: String(raw.telefone || "").trim() || null,
    email: String(raw.email || "").trim().toLowerCase() || null,
    ePrincipalResponsavel: raw.ePrincipalResponsavel || null,
  };
}

function normalizeContatoEmergencia(raw = {}) {
  return {
    nome: String(raw.nome || "").trim() || null,
    telefone: String(raw.telefone || "").trim() || null,
    vinculo: String(raw.vinculo || "").trim() || null,
    moraNaMesmaResidencia:
      typeof raw.moraNaMesmaResidencia === "boolean" ? raw.moraNaMesmaResidencia : null,
  };
}

// ── Campos da etapa 2: endereço ────────────────────────────────────────────

function normalizeEndereco(body = {}) {
  const cepRaw = stripToDigits(body.cep);
  if (cepRaw && !isValidCep(cepRaw)) {
    throw createAssistidoError("CEP inválido.", 400);
  }

  return {
    cep: cepRaw || null,
    logradouro: String(body.logradouro || "").trim() || null,
    numero: String(body.numero || "").trim() || null,
    complemento: String(body.complemento || "").trim() || null,
    pontoReferencia: String(body.pontoReferencia || "").trim() || null,
    bairro: String(body.bairro || "").trim() || null,
    cidade: String(body.cidade || "").trim() || null,
    estado: String(body.estado || "").trim() || null,
    tipoMoradia: String(body.tipoMoradia || "").trim() || null,
    tempoMoradia: String(body.tempoMoradia || "").trim() || null,
    microarea: String(body.microarea || "").trim() || null,
  };
}

// ── Controle de status ─────────────────────────────────────────────────────

function normalizeStatus(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!STATUS_CADASTRO.includes(s)) {
    throw createAssistidoError("Status inválido.", 400);
  }
  return s;
}

// ── Faixa etária calculada ─────────────────────────────────────────────────

function calcularFaixaEtaria(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const anos = hoje.getFullYear() - dataNascimento.getFullYear();
  const aniversarioPassou =
    hoje.getMonth() > dataNascimento.getMonth() ||
    (hoje.getMonth() === dataNascimento.getMonth() && hoje.getDate() >= dataNascimento.getDate());
  const idadeReal = aniversarioPassou ? anos : anos - 1;

  if (idadeReal < 12) return "crianca";
  if (idadeReal < 18) return "adolescente";
  if (idadeReal < 60) return "adulto";
  return "idoso";
}

module.exports = {
  normalizeDadosPessoais,
  normalizeEndereco,
  normalizeResponsavel,
  normalizeContatoEmergencia,
  normalizeStatus,
  calcularFaixaEtaria,
  isValidCpf,
  isValidCep,
  isValidPhone,
  isIsoDate,
};
