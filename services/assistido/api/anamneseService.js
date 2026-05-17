const { FichaAnamnese } = require("../../../schemas/social/FichaAnamnese");
const { Assistido } = require("../../../schemas/social/Assistido");
const { createAssistidoError } = require("./assistidoContextService");
const { ensureAssistidoAcessivel } = require("./assistidoGuardService");
const { ensureValidObjectId } = require("../../shared/objectIdValidationService");
const {
  FAIXA_ETARIA,
  ESTADO_GERAL,
  DOENCAS_CRONICAS,
  HISTORICO_FAMILIAR,
  SINTOMAS_MENTAIS,
  TABAGISMO,
  ETILISMO,
  SUBSTANCIAS,
  ATIVIDADE_FISICA,
  QUALIDADE_ALIMENTACAO,
  OCUPACAO,
  SIM_NAO_NAO_SABE,
} = require("../../../schemas/social/FichaAnamnese");

function normalizeEnum(value, allowed, label) {
  if (!value) return null;
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

function normalizeFichaAnamnese(body = {}) {
  return {
    faixaEtaria: normalizeEnum(body.faixaEtaria, FAIXA_ETARIA, "faixa etária"),
    queixaPrincipal: String(body.queixaPrincipal || "").trim() || null,
    estadoGeralPercebido: normalizeEnum(body.estadoGeralPercebido, ESTADO_GERAL, "estado geral"),
    peso: normalizeNumber(body.peso, 0, 500, "Peso"),
    altura: normalizeNumber(body.altura, 0, 300, "Altura"),

    antecedentesPessoais: {
      doencasCronicas: normalizeStringArray(body.antecedentesPessoais?.doencasCronicas, DOENCAS_CRONICAS, "doenças crônicas"),
      cirurgiasPrevias: String(body.antecedentesPessoais?.cirurgiasPrevias || "").trim() || null,
      internacoes: String(body.antecedentesPessoais?.internacoes || "").trim() || null,
      medicamentosUso: String(body.antecedentesPessoais?.medicamentosUso || "").trim() || null,
      alergias: String(body.antecedentesPessoais?.alergias || "").trim() || null,
      ultimaConsultaMedica: String(body.antecedentesPessoais?.ultimaConsultaMedica || "").trim() || null,
    },

    historicoFamiliar: {
      doencas: normalizeStringArray(body.historicoFamiliar?.doencas, HISTORICO_FAMILIAR, "histórico familiar"),
      observacoes: String(body.historicoFamiliar?.observacoes || "").trim() || null,
    },

    saudeMental: {
      acompanhamentoPsicologico: normalizeEnum(body.saudeMental?.acompanhamentoPsicologico, SIM_NAO_NAO_SABE, "acompanhamento psicológico"),
      medicacaoPsiquiatrica: normalizeEnum(body.saudeMental?.medicacaoPsiquiatrica, SIM_NAO_NAO_SABE, "medicação psiquiátrica"),
      internacaoPsiquiatrica: normalizeEnum(body.saudeMental?.internacaoPsiquiatrica, SIM_NAO_NAO_SABE, "internação psiquiátrica"),
      sintomasPresentes: normalizeStringArray(body.saudeMental?.sintomasPresentes, SINTOMAS_MENTAIS, "sintomas mentais"),
      descricaoSono: String(body.saudeMental?.descricaoSono || "").trim() || null,
      nivelEstresse: normalizeNumber(body.saudeMental?.nivelEstresse, 0, 10, "Nível de estresse"),
    },

    habitosVida: {
      tabagismo: normalizeEnum(body.habitosVida?.tabagismo, TABAGISMO, "tabagismo"),
      etilismo: normalizeEnum(body.habitosVida?.etilismo, ETILISMO, "etilismo"),
      outrasSubstancias: normalizeEnum(body.habitosVida?.outrasSubstancias, SUBSTANCIAS, "outras substâncias"),
      atividadeFisica: normalizeEnum(body.habitosVida?.atividadeFisica, ATIVIDADE_FISICA, "atividade física"),
      qualidadeAlimentacao: normalizeEnum(body.habitosVida?.qualidadeAlimentacao, QUALIDADE_ALIMENTACAO, "qualidade da alimentação"),
      restricoesAlimentares: String(body.habitosVida?.restricoesAlimentares || "").trim() || null,
    },

    trabalho: {
      profissao: String(body.trabalho?.profissao || "").trim() || null,
      ocupacaoAtual: normalizeEnum(body.trabalho?.ocupacaoAtual, OCUPACAO, "ocupação atual"),
      cargaHorariaSemanal: normalizeNumber(body.trabalho?.cargaHorariaSemanal, 0, 168, "Carga horária"),
      doencasOcupacionais: String(body.trabalho?.doencasOcupacionais || "").trim() || null,
    },

    hipoteseDiagnostica: String(body.hipoteseDiagnostica || "").trim() || null,
    planoCuidado: String(body.planoCuidado || "").trim() || null,
  };
}

// ── Criar nova versão de anamnese ──────────────────────────────────────────

async function criarAnamnese({ actorId, assistidoId, body = {} }) {
  await ensureAssistidoAcessivel({
    user: null,
    assistidoId,
    select: "_id",
    requireActive: false,
  });

  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");

  const ultima = await FichaAnamnese.findOne({ assistidoId: id }).sort({ versao: -1 }).select("versao");
  const versao = (ultima?.versao || 0) + 1;

  const dados = normalizeFichaAnamnese(body);

  // Campos livres do formulário (todas as chaves do form com data-custom-field-key)
  const camposRaw = body.campos || {};
  const campos = new Map(
    Object.entries(camposRaw).map(([k, v]) => [String(k).trim(), String(v ?? "").trim()])
  );

  const ficha = await FichaAnamnese.create({
    assistidoId: id,
    versao,
    ...dados,
    campos,
    criadoPor: actorId,
    atualizadoPor: actorId,
  });

  // Avança etapa do assistido para pelo menos etapa 3
  await Assistido.findByIdAndUpdate(id, {
    $max: { etapaConcluida: 3 },
    atualizadoPor: actorId,
  });

  return {
    mensagem: `Ficha de anamnese salva (versão ${versao}).`,
    ficha,
    audit: {
      acao: "ANAMNESE_CRIADA",
      entidade: "fichaAnamnese",
      entidadeId: ficha._id,
      detalhes: { assistidoId: id, versao },
    },
  };
}

// ── Buscar versão mais recente ─────────────────────────────────────────────

async function buscarAnamneseAtual({ assistidoId }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  const ficha = await FichaAnamnese.findOne({ assistidoId: id }).sort({ versao: -1 });
  if (!ficha) throw createAssistidoError("Nenhuma ficha de anamnese encontrada.", 404);
  return ficha;
}

// ── Buscar versão específica ───────────────────────────────────────────────

async function buscarAnamnese({ assistidoId, versao }) {
  const id = ensureValidObjectId(assistidoId, "Identificador de assistido inválido.");
  const v = Number(versao);
  if (!v || Number.isNaN(v)) throw createAssistidoError("Versão inválida.", 400);
  const ficha = await FichaAnamnese.findOne({ assistidoId: id, versao: v });
  if (!ficha) throw createAssistidoError("Versão de anamnese não encontrada.", 404);
  return ficha;
}

module.exports = {
  criarAnamnese,
  buscarAnamneseAtual,
  buscarAnamnese,
};
