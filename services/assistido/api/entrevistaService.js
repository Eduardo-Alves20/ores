const { EntrevistaSocial } = require("../../../schemas/social/EntrevistaSocial");
const { Assistido } = require("../../../schemas/social/Assistido");
const { createAssistidoError } = require("./assistidoContextService");
const { ensureAssistidoAcessivel } = require("./assistidoGuardService");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");
const {
  LOCAL_ENTREVISTA,
  FONTES_RENDA,
  SITUACAO_BENEFICIO,
  COND_MORADIA,
  ESCOLARIDADE,
  NIVEL_RISCO,
  SIM_NAO_SUSPEITA,
} = require("../../../schemas/social/EntrevistaSocial");

function normalizeEnum(value, allowed, label) {
  if (!value && value !== 0) return null;
  const v = String(value).trim().toLowerCase();
  if (!allowed.includes(v)) throw createAssistidoError(`Valor inválido para ${label}: "${v}".`, 400);
  return v;
}

function normalizeStringArray(arr, allowed, label) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const v = String(item || "").trim().toLowerCase();
    if (!allowed.includes(v)) throw createAssistidoError(`Valor inválido em ${label}: "${v}".`, 400);
    return v;
  });
}

function normalizeNumber(value, min, max, label) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) throw createAssistidoError(`${label} deve ser um número.`, 400);
  if (n < min || n > max) throw createAssistidoError(`${label} deve estar entre ${min} e ${max}.`, 400);
  return n;
}

function normalizeBoolean(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function normalizeMembros(arr = []) {
  if (!Array.isArray(arr)) return [];
  return arr.map((m) => ({
    nome: String(m.nome || "").trim() || null,
    parentesco: String(m.parentesco || "").trim() || null,
    idade: m.idade != null ? Number(m.idade) : null,
    ocupacao: String(m.ocupacao || "").trim() || null,
    observacoes: String(m.observacoes || "").trim() || null,
  }));
}

function normalizeEntrevistaSocial(body = {}) {
  if (!body.dataEntrevista) throw createAssistidoError("Data da entrevista é obrigatória.", 400);
  const dataEntrevista = new Date(body.dataEntrevista);
  if (Number.isNaN(dataEntrevista.getTime())) {
    throw createAssistidoError("Data da entrevista inválida.", 400);
  }

  return {
    dataEntrevista,
    local: normalizeEnum(body.local, LOCAL_ENTREVISTA, "local"),

    composicaoFamiliar: {
      totalMembros: normalizeNumber(body.composicaoFamiliar?.totalMembros, 1, 50, "Total de membros"),
      membros: normalizeMembros(body.composicaoFamiliar?.membros),
      chefeFamily: String(body.composicaoFamiliar?.chefeFamily || "").trim() || null,
      observacoes: String(body.composicaoFamiliar?.observacoes || "").trim() || null,
    },

    situacaoEconomica: {
      rendaFamiliarTotal: normalizeNumber(body.situacaoEconomica?.rendaFamiliarTotal, 0, 9999999, "Renda familiar"),
      percapita: normalizeNumber(body.situacaoEconomica?.percapita, 0, 9999999, "Renda per capita"),
      fontesRenda: normalizeStringArray(body.situacaoEconomica?.fontesRenda, FONTES_RENDA, "fontes de renda"),
      recebeBeneficioSocial: normalizeBoolean(body.situacaoEconomica?.recebeBeneficioSocial),
      beneficiosDetalhes: String(body.situacaoEconomica?.beneficiosDetalhes || "").trim() || null,
      cadastroUnico: normalizeBoolean(body.situacaoEconomica?.cadastroUnico),
      nis: String(body.situacaoEconomica?.nis || "").trim() || null,
      situacaoBeneficio: normalizeEnum(body.situacaoEconomica?.situacaoBeneficio, SITUACAO_BENEFICIO, "situação do benefício"),
    },

    habitacao: {
      condicoesMoradia: normalizeEnum(body.habitacao?.condicoesMoradia, COND_MORADIA, "condições de moradia"),
      aguaEncanada: normalizeBoolean(body.habitacao?.aguaEncanada),
      esgoto: normalizeBoolean(body.habitacao?.esgoto),
      coleta: normalizeBoolean(body.habitacao?.coleta),
      iluminacao: normalizeBoolean(body.habitacao?.iluminacao),
      totalComodos: normalizeNumber(body.habitacao?.totalComodos, 0, 99, "Total de cômodos"),
      totalPessoas: normalizeNumber(body.habitacao?.totalPessoas, 0, 99, "Total de pessoas"),
      observacoes: String(body.habitacao?.observacoes || "").trim() || null,
    },

    saude: {
      possuiPlanoSaude: normalizeBoolean(body.saude?.possuiPlanoSaude),
      planoNome: String(body.saude?.planoNome || "").trim() || null,
      acompanhamentoMedico: normalizeBoolean(body.saude?.acompanhamentoMedico),
      servicosSaude: String(body.saude?.servicosSaude || "").trim() || null,
      barreirasAcesso: String(body.saude?.barreirasAcesso || "").trim() || null,
    },

    educacao: {
      escolaridade: normalizeEnum(body.educacao?.escolaridade, ESCOLARIDADE, "escolaridade"),
      frequentaEscola: normalizeBoolean(body.educacao?.frequentaEscola),
      instituicaoEnsino: String(body.educacao?.instituicaoEnsino || "").trim() || null,
      serieAno: String(body.educacao?.serieAno || "").trim() || null,
      observacoes: String(body.educacao?.observacoes || "").trim() || null,
    },

    redeApoio: {
      redesFamiliares: String(body.redeApoio?.redesFamiliares || "").trim() || null,
      redesComunitarias: String(body.redeApoio?.redesComunitarias || "").trim() || null,
      servicosSocioassistenciais: String(body.redeApoio?.servicosSocioassistenciais || "").trim() || null,
      religiao: String(body.redeApoio?.religiao || "").trim() || null,
      observacoes: String(body.redeApoio?.observacoes || "").trim() || null,
    },

    vulnerabilidades: {
      violenciaDomestica: normalizeEnum(body.vulnerabilidades?.violenciaDomestica, SIM_NAO_SUSPEITA, "violência doméstica"),
      abusoDrogas: normalizeEnum(body.vulnerabilidades?.abusoDrogas, SIM_NAO_SUSPEITA, "abuso de drogas"),
      exploracaoInfantil: normalizeEnum(body.vulnerabilidades?.exploracaoInfantil, SIM_NAO_SUSPEITA, "exploração infantil"),
      situacaoRua: normalizeBoolean(body.vulnerabilidades?.situacaoRua),
      outrasVulnerabilidades: String(body.vulnerabilidades?.outrasVulnerabilidades || "").trim() || null,
      nivelRisco: normalizeEnum(body.vulnerabilidades?.nivelRisco, NIVEL_RISCO, "nível de risco"),
    },

    demandas: {
      demandaIdentificada: String(body.demandas?.demandaIdentificada || "").trim() || null,
      encaminhamentos: String(body.demandas?.encaminhamentos || "").trim() || null,
      parecerSocial: String(body.demandas?.parecerSocial || "").trim() || null,
      proximosPassos: String(body.demandas?.proximosPassos || "").trim() || null,
    },
  };
}

// ── Criar nova versão de entrevista ────────────────────────────────────────

async function criarEntrevista({ actorId, assistidoId, body = {} }) {
  await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id",
    requireActive: false,
  });

  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");

  const ultima = await EntrevistaSocial.findOne({ assistidoId: id }).sort({ versao: -1 }).select("versao");
  const versao = (ultima?.versao || 0) + 1;

  const dados = normalizeEntrevistaSocial(body);

  const camposRaw = body.campos || {};
  const campos = new Map(
    Object.entries(camposRaw).map(([k, v]) => [String(k).trim(), String(v ?? "").trim()])
  );

  const entrevista = await EntrevistaSocial.create({
    assistidoId: id,
    versao,
    ...dados,
    campos,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  // Avança etapa do assistido para pelo menos etapa 4
  await Assistido.findByIdAndUpdate(id, {
    $max: { etapaConcluida: 4 },
    atualizadoPor: actorId,
  });

  return {
    mensagem: `Entrevista social salva (versão ${versao}).`,
    entrevista,
    audit: {
      acao: "ENTREVISTA_SOCIAL_CRIADA",
      entidade: "entrevistaSocial",
      entidadeId: entrevista._id,
      detalhes: { assistidoId: id, versao },
    },
  };
}

// ── Buscar versão mais recente ─────────────────────────────────────────────

async function buscarEntrevistaAtual({ assistidoId }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  const entrevista = await EntrevistaSocial.findOne({ assistidoId: id }).sort({ versao: -1 });
  if (!entrevista) throw createAssistidoError("Nenhuma entrevista social encontrada.", 404);
  return entrevista;
}

// ── Buscar versão específica ───────────────────────────────────────────────

async function buscarEntrevista({ assistidoId, versao }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  const v = Number(versao);
  if (!v || Number.isNaN(v)) throw createAssistidoError("Versão inválida.", 400);
  const entrevista = await EntrevistaSocial.findOne({ assistidoId: id, versao: v });
  if (!entrevista) throw createAssistidoError("Versão de entrevista não encontrada.", 404);
  return entrevista;
}

module.exports = {
  criarEntrevista,
  buscarEntrevistaAtual,
  buscarEntrevista,
};
