const mongoose = require("mongoose");

const LOCAL_ENTREVISTA = Object.freeze([
  "sede", "domicilio", "cras", "ubs", "escola", "hospital", "remoto", "outro",
]);

const FONTES_RENDA = Object.freeze([
  "trabalho", "autonomo", "aposentadoria", "pensao", "bolsa_familia",
  "bpc", "aluguel", "pensao_alimenticia", "doacao", "outro",
]);

const SITUACAO_BENEFICIO = Object.freeze([
  "ativo", "suspenso", "cancelado", "em_analise", "nao_possui",
]);

const COND_MORADIA = Object.freeze(["boa", "regular", "precaria", "insalubre"]);

const ESCOLARIDADE = Object.freeze([
  "nao_alfabetizado", "fundamental_incompleto", "fundamental_completo",
  "medio_incompleto", "medio_completo", "superior_incompleto",
  "superior_completo", "pos_graduacao",
]);

const NIVEL_RISCO = Object.freeze(["baixo", "medio", "alto", "critico"]);
const SIM_NAO_SUSPEITA = Object.freeze(["sim", "nao", "suspeita", "nao_sabe"]);

const MembroFamiliarSchema = new mongoose.Schema(
  {
    nome: { type: String, trim: true },
    parentesco: { type: String, trim: true },
    idade: { type: Number, min: 0, default: null },
    ocupacao: { type: String, trim: true },
    observacoes: { type: String, trim: true },
  },
  { _id: false }
);

const EntrevistaSocialSchema = new mongoose.Schema(
  {
    assistidoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assistido",
      required: true,
      index: true,
    },
    versao: { type: Number, required: true, default: 1, min: 1 },
    dataEntrevista: { type: Date, required: true },
    local: { type: String, enum: [...LOCAL_ENTREVISTA, null], default: null },

    // Composição familiar
    composicaoFamiliar: {
      totalMembros: { type: Number, min: 1, default: null },
      membros: { type: [MembroFamiliarSchema], default: [] },
      chefeFamily: { type: String, trim: true },
      observacoes: { type: String, trim: true, maxlength: 1000 },
    },

    // Situação econômica
    situacaoEconomica: {
      rendaFamiliarTotal: { type: Number, min: 0, default: null },
      percapita: { type: Number, min: 0, default: null },
      fontesRenda: { type: [String], enum: FONTES_RENDA, default: [] },
      recebeBeneficioSocial: { type: Boolean, default: null },
      beneficiosDetalhes: { type: String, trim: true, maxlength: 1000 },
      cadastroUnico: { type: Boolean, default: null },
      nis: { type: String, trim: true },
      situacaoBeneficio: { type: String, enum: [...SITUACAO_BENEFICIO, null], default: null },
    },

    // Habitação
    habitacao: {
      condicoesMoradia: { type: String, enum: [...COND_MORADIA, null], default: null },
      aguaEncanada: { type: Boolean, default: null },
      esgoto: { type: Boolean, default: null },
      coleta: { type: Boolean, default: null },
      iluminacao: { type: Boolean, default: null },
      totalComodos: { type: Number, min: 0, default: null },
      totalPessoas: { type: Number, min: 0, default: null },
      observacoes: { type: String, trim: true, maxlength: 1000 },
    },

    // Saúde
    saude: {
      possuiPlanoSaude: { type: Boolean, default: null },
      planoNome: { type: String, trim: true },
      acompanhamentoMedico: { type: Boolean, default: null },
      servicosSaude: { type: String, trim: true, maxlength: 1000 },
      barreirasAcesso: { type: String, trim: true, maxlength: 1000 },
    },

    // Educação
    educacao: {
      escolaridade: { type: String, enum: [...ESCOLARIDADE, null], default: null },
      frequentaEscola: { type: Boolean, default: null },
      instituicaoEnsino: { type: String, trim: true },
      serieAno: { type: String, trim: true },
      observacoes: { type: String, trim: true, maxlength: 1000 },
    },

    // Rede de apoio
    redeApoio: {
      redesFamiliares: { type: String, trim: true, maxlength: 1000 },
      redesComunitarias: { type: String, trim: true, maxlength: 1000 },
      servicosSocioassistenciais: { type: String, trim: true, maxlength: 1000 },
      religiao: { type: String, trim: true },
      observacoes: { type: String, trim: true, maxlength: 1000 },
    },

    // Vulnerabilidades e riscos
    vulnerabilidades: {
      violenciaDomestica: { type: String, enum: [...SIM_NAO_SUSPEITA, null], default: null },
      abusoDrogas: { type: String, enum: [...SIM_NAO_SUSPEITA, null], default: null },
      exploracaoInfantil: { type: String, enum: [...SIM_NAO_SUSPEITA, null], default: null },
      situacaoRua: { type: Boolean, default: null },
      outrasVulnerabilidades: { type: String, trim: true, maxlength: 1000 },
      nivelRisco: { type: String, enum: [...NIVEL_RISCO, null], default: null },
    },

    // Demandas e encaminhamentos
    demandas: {
      demandaIdentificada: { type: String, trim: true, maxlength: 3000 },
      encaminhamentos: { type: String, trim: true, maxlength: 3000 },
      parecerSocial: { type: String, trim: true, maxlength: 5000 },
      proximosPassos: { type: String, trim: true, maxlength: 2000 },
    },

    // Todos os campos livres do formulário (chave → valor texto)
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
    collection: "EntrevistasSociais",
  }
);

EntrevistaSocialSchema.index({ assistidoId: 1, versao: -1 });

module.exports = {
  EntrevistaSocial: mongoose.model("EntrevistaSocial", EntrevistaSocialSchema),
  LOCAL_ENTREVISTA,
  FONTES_RENDA,
  SITUACAO_BENEFICIO,
  COND_MORADIA,
  ESCOLARIDADE,
  NIVEL_RISCO,
  SIM_NAO_SUSPEITA,
};
