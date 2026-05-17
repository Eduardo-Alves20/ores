const mongoose = require("mongoose");

const FAIXA_ETARIA = Object.freeze(["crianca", "adolescente", "adulto", "idoso"]);
const ESTADO_GERAL = Object.freeze(["otimo", "bom", "regular", "ruim", "critico"]);
const SIM_NAO_NAO_SABE = Object.freeze(["sim", "nao", "nao_sabe"]);

const DOENCAS_CRONICAS = Object.freeze([
  "hipertensao", "diabetes", "cardiopatia", "asma_dpoc", "tireoide",
  "obesidade", "cancer", "hiv", "hepatite", "renais", "reumaticas", "nenhuma",
]);

const HISTORICO_FAMILIAR = Object.freeze([
  "hf_hipertensao", "hf_diabetes", "hf_cancer", "hf_cardiopatia", "hf_avc",
  "hf_doenca_mental", "hf_alcoolismo", "hf_suicidio", "hf_doencas_geneticas", "hf_nenhum",
]);

const SINTOMAS_MENTAIS = Object.freeze([
  "sm_tristeza", "sm_ansiedade", "sm_insonia", "sm_crises_panico",
  "sm_ideacao_suicida", "sm_irritabilidade", "sm_falta_motivacao", "sm_isolamento", "sm_nenhum",
]);

const TABAGISMO = Object.freeze(["nao_fuma", "ex_fumante", "fumante_leve", "fumante_mod", "fumante_pesado"]);
const ETILISMO = Object.freeze(["nao_usa", "social", "moderado", "frequente", "dependente"]);
const SUBSTANCIAS = Object.freeze(["nao_usa", "cannabis", "cocaina", "multiplas", "outra"]);
const ATIVIDADE_FISICA = Object.freeze(["sedentario", "leve", "moderado", "intenso"]);
const QUALIDADE_ALIMENTACAO = Object.freeze(["boa", "regular", "insuficiente", "inseguranca"]);
const OCUPACAO = Object.freeze([
  "empregado_clt", "autonomo", "servidor_pub", "desempregado",
  "aposentado", "estudante", "inativo",
]);

const FichaAnamneseSchema = new mongoose.Schema(
  {
    assistidoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assistido",
      required: true,
      index: true,
    },
    versao: { type: Number, required: true, default: 1, min: 1 },
    faixaEtaria: { type: String, enum: [...FAIXA_ETARIA, null], default: null },

    // Queixa e estado geral
    queixaPrincipal: { type: String, trim: true, maxlength: 2000 },
    estadoGeralPercebido: { type: String, enum: [...ESTADO_GERAL, null], default: null },

    // Dados antropométricos
    peso: { type: Number, min: 0, max: 500, default: null },  // kg
    altura: { type: Number, min: 0, max: 300, default: null }, // cm

    // Antecedentes pessoais
    antecedentesPessoais: {
      doencasCronicas: { type: [String], enum: DOENCAS_CRONICAS, default: [] },
      cirurgiasPrevias: { type: String, trim: true, maxlength: 2000 },
      internacoes: { type: String, trim: true, maxlength: 2000 },
      medicamentosUso: { type: String, trim: true, maxlength: 2000 },
      alergias: { type: String, trim: true, maxlength: 1000 },
      ultimaConsultaMedica: { type: String, trim: true, maxlength: 500 },
    },

    // Histórico familiar
    historicoFamiliar: {
      doencas: { type: [String], enum: HISTORICO_FAMILIAR, default: [] },
      observacoes: { type: String, trim: true, maxlength: 1000 },
    },

    // Saúde mental
    saudeMental: {
      acompanhamentoPsicologico: { type: String, enum: [...SIM_NAO_NAO_SABE, null], default: null },
      medicacaoPsiquiatrica: { type: String, enum: [...SIM_NAO_NAO_SABE, null], default: null },
      internacaoPsiquiatrica: { type: String, enum: [...SIM_NAO_NAO_SABE, null], default: null },
      sintomasPresentes: { type: [String], enum: SINTOMAS_MENTAIS, default: [] },
      descricaoSono: { type: String, trim: true, maxlength: 1000 },
      nivelEstresse: { type: Number, min: 0, max: 10, default: null },
    },

    // Hábitos de vida
    habitosVida: {
      tabagismo: { type: String, enum: [...TABAGISMO, null], default: null },
      etilismo: { type: String, enum: [...ETILISMO, null], default: null },
      outrasSubstancias: { type: String, enum: [...SUBSTANCIAS, null], default: null },
      atividadeFisica: { type: String, enum: [...ATIVIDADE_FISICA, null], default: null },
      qualidadeAlimentacao: { type: String, enum: [...QUALIDADE_ALIMENTACAO, null], default: null },
      restricoesAlimentares: { type: String, trim: true, maxlength: 500 },
    },

    // Trabalho e ocupação
    trabalho: {
      profissao: { type: String, trim: true, maxlength: 200 },
      ocupacaoAtual: { type: String, enum: [...OCUPACAO, null], default: null },
      cargaHorariaSemanal: { type: Number, min: 0, max: 168, default: null },
      doencasOcupacionais: { type: String, trim: true, maxlength: 1000 },
    },

    // Conclusão clínica
    hipoteseDiagnostica: { type: String, trim: true, maxlength: 3000 },
    planoCuidado: { type: String, trim: true, maxlength: 3000 },

    // Todos os campos livres do formulário (chave → valor texto)
    // Permite salvar qualquer campo narrativo sem perda de dados
    campos: {
      type: Map,
      of: String,
      default: {},
    },

    // Auditoria
    criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true },
    atualizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
  },
  {
    timestamps: true,
    collection: "FichasAnamnese",
  }
);

// Permite buscar a versão mais recente de um assistido eficientemente
FichaAnamneseSchema.index({ assistidoId: 1, versao: -1 });

module.exports = {
  FichaAnamnese: mongoose.model("FichaAnamnese", FichaAnamneseSchema),
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
};
