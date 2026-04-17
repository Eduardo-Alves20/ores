const {
  ConfiguracaoSistema,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_AREAS,
  QUICK_FILTER_AREAS,
  PRESENCA_JUSTIFICATIVA_STATUSES,
  CAMPANHA_ANIVERSARIO_STATUSES,
  CAMPANHA_ANIVERSARIO_PUBLICOS,
  CAMPANHA_ANIVERSARIO_CANAIS,
  CAMPANHA_ANIVERSARIO_ACOES,
} = require("../../schemas/core/ConfiguracaoSistema");

const FILTER_AREA_DEFINITIONS = Object.freeze({
  assistidos_familias: {
    label: "Assistidos > Familias",
    fields: [
      {
        value: "ativo",
        label: "Status da familia",
        type: "select",
        options: [
          { value: "true", label: "Somente ativas" },
          { value: "false", label: "Somente inativas" },
        ],
      },
      {
        value: "parentesco",
        label: "Parentesco",
        type: "text",
        placeholder: "Ex.: mae, tio, adotante",
      },
      {
        value: "cidade",
        label: "Cidade",
        type: "text",
        placeholder: "Ex.: Araruama",
      },
    ],
  },
  acessos_familias: {
    label: "Usuarios > Familias",
    fields: [
      {
        value: "status",
        label: "Status de aprovacao",
        type: "select",
        options: [
          { value: "pendente", label: "Pendentes" },
          { value: "aprovado", label: "Aprovados" },
          { value: "rejeitado", label: "Rejeitados" },
        ],
      },
      {
        value: "ativo",
        label: "Acesso",
        type: "select",
        options: [
          { value: "true", label: "Somente ativos" },
          { value: "false", label: "Somente inativos" },
        ],
      },
    ],
  },
  acessos_voluntarios: {
    label: "Usuarios > Voluntarios",
    fields: [
      {
        value: "status",
        label: "Status de aprovacao",
        type: "select",
        options: [
          { value: "pendente", label: "Pendentes" },
          { value: "aprovado", label: "Aprovados" },
          { value: "rejeitado", label: "Rejeitados" },
        ],
      },
      {
        value: "ativo",
        label: "Acesso",
        type: "select",
        options: [
          { value: "true", label: "Somente ativos" },
          { value: "false", label: "Somente inativos" },
        ],
      },
      {
        value: "perfil",
        label: "Perfil",
        type: "select",
        options: [
          { value: "usuario", label: "Usuario" },
          { value: "admin", label: "admin_ORES" },
          { value: "atendente", label: "Atendente" },
          { value: "tecnico", label: "Tecnico" },
        ],
      },
    ],
  },
  agenda_presencas: {
    label: "Agenda > Presencas",
    fields: [
      {
        value: "statusPresenca",
        label: "Status de presenca",
        type: "select",
        options: [
          { value: "presente", label: "Somente presencas" },
          { value: "falta", label: "Somente faltas" },
          { value: "falta_justificada", label: "Somente justificadas" },
          { value: "pendente", label: "Somente pendentes" },
          { value: "cancelado_antecipadamente", label: "Somente canceladas" },
        ],
      },
    ],
  },
});

const CUSTOM_FIELD_TYPE_LABELS = Object.freeze({
  texto: "Texto curto",
  textarea: "Texto longo",
  numero: "Numero",
  data: "Data",
  select: "Lista de opcoes",
  booleano: "Sim / Nao",
});

const CUSTOM_FIELD_AREA_LABELS = Object.freeze({
  familia: "Familia",
  usuario: "Usuario",
});

const PRESENCA_STATUS_LABELS = Object.freeze({
  falta: "Falta",
  falta_justificada: "Falta justificada",
  cancelado_antecipadamente: "Cancelado antecipadamente",
});

const CAMPANHA_ANIVERSARIO_STATUS_LABELS = Object.freeze({
  rascunho: "Rascunho",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
});

const CAMPANHA_ANIVERSARIO_PUBLICO_LABELS = Object.freeze({
  familia: "Familia",
  voluntario: "Voluntario",
  orgao_publico: "Orgao Publico",
});

const CAMPANHA_ANIVERSARIO_CANAL_LABELS = Object.freeze({
  sistema: "Sistema",
  whatsapp: "WhatsApp",
  email: "E-mail",
});

const CAMPANHA_ANIVERSARIO_ACAO_LABELS = Object.freeze({
  exibir_dashboard: "Exibir no dashboard",
  mensagem_sistema: "Mensagem no sistema",
  whatsapp: "Mensagem por WhatsApp",
  email: "E-mail",
});

function createConfigError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseBoolean(value, fallback = false) {
  if (value === true || value === "true" || value === "1" || value === 1 || value === "on") return true;
  if (value === false || value === "false" || value === "0" || value === 0 || value === "off") return false;
  return fallback;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function normalizeKey(value, max = 80) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
}

function normalizeList(value) {
  const items = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|,/)
        .map((item) => item.trim());

  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function sortByOrder(list = []) {
  return [...list].sort((a, b) => {
    const orderDiff = Number(a?.ordem || 0) - Number(b?.ordem || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.nome || a?.label || "")
      .localeCompare(String(b?.nome || b?.label || ""), "pt-BR");
  });
}

function sortBirthdayCampaigns(list = []) {
  return [...list].sort((a, b) => {
    const priorityDiff = Number(a?.prioridade || 0) - Number(b?.prioridade || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR");
  });
}

function mapPresenceReason(item) {
  return {
    _id: String(item?._id || ""),
    nome: String(item?.nome || ""),
    descricao: String(item?.descricao || ""),
    ativo: item?.ativo !== false,
    ordem: Number(item?.ordem || 0),
    aplicaEm: Array.isArray(item?.aplicaEm) ? item.aplicaEm : [],
    aplicaEmLabels: (Array.isArray(item?.aplicaEm) ? item.aplicaEm : []).map(
      (status) => PRESENCA_STATUS_LABELS[status] || status
    ),
  };
}

function mapCustomField(item) {
  const tipo = String(item?.tipo || "texto").trim();
  const area = String(item?.area || "").trim();
  return {
    _id: String(item?._id || ""),
    area,
    areaLabel: CUSTOM_FIELD_AREA_LABELS[area] || area,
    label: String(item?.label || ""),
    chave: String(item?.chave || ""),
    tipo,
    tipoLabel: CUSTOM_FIELD_TYPE_LABELS[tipo] || tipo,
    placeholder: String(item?.placeholder || ""),
    ajuda: String(item?.ajuda || ""),
    obrigatorio: item?.obrigatorio === true,
    ativo: item?.ativo !== false,
    ordem: Number(item?.ordem || 0),
    opcoes: Array.isArray(item?.opcoes) ? item.opcoes : [],
  };
}

function mapQuickFilter(item) {
  const area = String(item?.area || "").trim();
  const field = String(item?.campo || "").trim();
  const fieldDef = (FILTER_AREA_DEFINITIONS[area]?.fields || []).find((current) => current.value === field);
  return {
    _id: String(item?._id || ""),
    area,
    areaLabel: FILTER_AREA_DEFINITIONS[area]?.label || area,
    nome: String(item?.nome || ""),
    descricao: String(item?.descricao || ""),
    campo: field,
    campoLabel: fieldDef?.label || field,
    valor: String(item?.valor || ""),
    valorLabel: String(item?.valorLabel || item?.valor || ""),
    ativo: item?.ativo !== false,
    destaque: item?.destaque === true,
    ordem: Number(item?.ordem || 0),
  };
}

function normalizeMultilineList(value, maxItems = 18, maxLength = 320) {
  const lines = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n/)
        .map((item) => item.trim());

  return Array.from(
    new Set(
      lines
        .map((item) => String(item || "").trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    )
  );
}

function buildBirthdayWindowLabel(daysAhead) {
  const days = Math.max(0, toInt(daysAhead, 7));
  if (days <= 0) return "Somente hoje";
  if (days === 1) return "Hoje e amanha";
  return `Hoje e proximos ${days} dias`;
}

function countBirthdayMessageVariations(channel = {}) {
  const openings = Array.isArray(channel?.aberturas) ? channel.aberturas.length : 0;
  const messages = Array.isArray(channel?.mensagens) ? channel.mensagens.length : 0;
  const closings = Array.isArray(channel?.fechamentos) ? channel.fechamentos.length : 0;

  if (!messages) return 0;
  return Math.max(openings, 1) * messages * Math.max(closings, 1);
}

function mapBirthdayChannel(channel = {}) {
  return {
    assunto: String(channel?.assunto || ""),
    aberturas: normalizeMultilineList(channel?.aberturas, 18, 220),
    mensagens: normalizeMultilineList(channel?.mensagens, 24, 320),
    fechamentos: normalizeMultilineList(channel?.fechamentos, 18, 220),
  };
}

function mapBirthdayCampaign(item) {
  const status = String(item?.status || "rascunho").trim();
  const publico = Array.isArray(item?.publico) ? item.publico : [];
  const canais = Array.isArray(item?.canais) ? item.canais : [];
  const diasAntecedencia = Math.max(0, Number(item?.diasAntecedencia || 0));
  const mensagens = {
    sistema: mapBirthdayChannel(item?.mensagens?.sistema),
    whatsapp: mapBirthdayChannel(item?.mensagens?.whatsapp),
    email: mapBirthdayChannel(item?.mensagens?.email),
  };
  const canaisSelecionados = canais.length
    ? canais.filter((value) => CAMPANHA_ANIVERSARIO_CANAIS.includes(String(value || "").trim()))
    : ["sistema"];
  const variationsByChannel = canaisSelecionados.map((canal) => ({
    value: canal,
    label: CAMPANHA_ANIVERSARIO_CANAL_LABELS[canal] || canal,
    count: countBirthdayMessageVariations(mensagens?.[canal]),
  }));

  return {
    _id: String(item?._id || ""),
    nome: String(item?.nome || ""),
    descricao: String(item?.descricao || ""),
    status,
    statusLabel: CAMPANHA_ANIVERSARIO_STATUS_LABELS[status] || status,
    statusTone:
      status === "ativa"
        ? "active"
        : status === "rascunho"
          ? "warning"
          : status === "encerrada"
            ? "inactive"
            : "neutral",
    publico: publico.filter((value) =>
      CAMPANHA_ANIVERSARIO_PUBLICOS.includes(String(value || "").trim())
    ),
    publicoLabels: publico
      .filter((value) => CAMPANHA_ANIVERSARIO_PUBLICOS.includes(String(value || "").trim()))
      .map((value) => CAMPANHA_ANIVERSARIO_PUBLICO_LABELS[value] || value),
    canais: canaisSelecionados,
    canaisLabels: canaisSelecionados.map(
      (value) => CAMPANHA_ANIVERSARIO_CANAL_LABELS[value] || value
    ),
    diasAntecedencia,
    janelaLabel: buildBirthdayWindowLabel(diasAntecedencia),
    acaoPrimaria: String(item?.acaoPrimaria || "exibir_dashboard"),
    acaoPrimariaLabel:
      CAMPANHA_ANIVERSARIO_ACAO_LABELS[item?.acaoPrimaria] || item?.acaoPrimaria || "Exibir no dashboard",
    requerAprovacao: item?.requerAprovacao === true,
    prioridade: Number(item?.prioridade || 0),
    personalizacao: {
      variarPorPerfil: item?.personalizacao?.variarPorPerfil !== false,
      variarPorHistorico: item?.personalizacao?.variarPorHistorico !== false,
      evitarRepeticaoAnual: item?.personalizacao?.evitarRepeticaoAnual !== false,
    },
    mensagens,
    variacoesPorCanal: variationsByChannel,
    totalVariacoes: variationsByChannel.reduce((sum, channel) => sum + Number(channel.count || 0), 0),
  };
}

function buildQuickFilterHref(area, field, value) {
  const params = new URLSearchParams();
  const normalizedArea = String(area || "").trim();
  const normalizedField = String(field || "").trim();
  const normalizedValue = String(value || "").trim();
  if (!normalizedArea || !normalizedField || !normalizedValue) return "#";

  if (normalizedArea === "assistidos_familias") {
    params.set(normalizedField, normalizedValue);
    return `/familias?${params.toString()}`;
  }

  if (normalizedArea === "acessos_familias") {
    params.set(normalizedField, normalizedValue);
    return `/acessos/familias?${params.toString()}`;
  }

  if (normalizedArea === "acessos_voluntarios") {
    params.set(normalizedField, normalizedValue);
    return `/acessos/voluntarios?${params.toString()}`;
  }

  if (normalizedArea === "agenda_presencas") {
    params.set(normalizedField, normalizedValue);
    return `/agenda/presencas?${params.toString()}`;
  }

  return "#";
}

function buildDefaultBirthdayCampaignSeed() {
  return {
    nome: "Aniversariantes da semana",
    nomeNormalizado: "aniversariantes_da_semana",
    descricao:
      "Campanha inicial para destacar aniversariantes no painel e preparar a base de relacionamento por canal.",
    status: "ativa",
    publico: ["familia", "voluntario"],
    diasAntecedencia: 7,
    acaoPrimaria: "exibir_dashboard",
    canais: ["sistema", "email", "whatsapp"],
    requerAprovacao: false,
    prioridade: 1,
    personalizacao: {
      variarPorPerfil: true,
      variarPorHistorico: true,
      evitarRepeticaoAnual: true,
    },
    mensagens: {
      sistema: {
        assunto: "Feliz aniversario",
        aberturas: [
          "Hoje e um dia especial por aqui.",
          "Sua data chegou e a equipe quis celebrar junto.",
        ],
        mensagens: [
          "Que este novo ciclo traga cuidado, leveza e boas noticias para voce.",
          "Receba nosso carinho e o desejo de um ano cheio de saude, afeto e novas conquistas.",
          "Celebramos sua historia e a alegria de ter voce fazendo parte da nossa rede.",
        ],
        fechamentos: [
          "Conte com a gente.",
          "Seguimos juntos neste caminho.",
        ],
      },
      whatsapp: {
        aberturas: [
          "Passando para deixar um carinho especial no seu aniversario.",
          "Hoje o lembrete daqui veio com afeto redobrado.",
        ],
        mensagens: [
          "Que seu dia tenha leveza, afeto e bons encontros.",
          "Desejamos um novo ciclo cheio de saude, paz e coisas boas.",
        ],
        fechamentos: [
          "Um abraco da equipe ORES.",
          "Feliz aniversario.",
        ],
      },
      email: {
        assunto: "Um novo ciclo cheio de coisas boas",
        aberturas: [
          "Hoje queremos celebrar sua historia com calma e carinho.",
        ],
        mensagens: [
          "Que o seu aniversario marque o inicio de um novo tempo com mais serenidade, saude e oportunidades.",
          "Desejamos que este novo ciclo traga bons encontros, apoio e motivos sinceros para celebrar.",
        ],
        fechamentos: [
          "Com carinho, equipe Instituto ORES.",
        ],
      },
    },
  };
}

async function ensureConfigDocument() {
  let doc = await ConfiguracaoSistema.findOne({ chave: "default" });
  if (doc) {
    if (!Array.isArray(doc.campanhasAniversario) || !doc.campanhasAniversario.length) {
      doc.campanhasAniversario = [buildDefaultBirthdayCampaignSeed()];
      await doc.save();
    }
    return doc;
  }

  try {
    doc = await ConfiguracaoSistema.create({
      chave: "default",
      justificativasPresenca: [
        {
          nome: "Aviso previo da familia",
          nomeNormalizado: "aviso_previo_da_familia",
          descricao: "Quando a familia informou com antecedencia que nao conseguiria comparecer.",
          aplicaEm: ["falta_justificada", "cancelado_antecipadamente"],
          ativo: true,
          ordem: 1,
        },
        {
          nome: "Problema de transporte",
          nomeNormalizado: "problema_de_transporte",
          descricao: "Dificuldade de deslocamento, transporte ou acesso ate a unidade.",
          aplicaEm: ["falta_justificada"],
          ativo: true,
          ordem: 2,
        },
        {
          nome: "Indisposicao de saude",
          nomeNormalizado: "indisposicao_de_saude",
          descricao: "Condicao de saude que impediu o comparecimento.",
          aplicaEm: ["falta_justificada"],
          ativo: true,
          ordem: 3,
        },
      ],
      campanhasAniversario: [buildDefaultBirthdayCampaignSeed()],
    });

    return doc;
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await ConfiguracaoSistema.findOne({ chave: "default" });
      if (existing) return existing;
    }
    throw error;
  }
}

async function getSystemConfigSnapshot() {
  const doc = await ensureConfigDocument();
  return doc.toObject();
}

function validatePresenceReasonUniqueness(doc, currentId, nomeNormalizado) {
  const duplicate = (doc.justificativasPresenca || []).find(
    (item) =>
      String(item?._id || "") !== String(currentId || "") &&
      String(item?.nomeNormalizado || "") === String(nomeNormalizado || "")
  );

  if (duplicate) {
    throw createConfigError("Ja existe uma justificativa de presenca com esse nome.");
  }
}

function validateCustomFieldUniqueness(doc, currentId, area, chaveNormalizada) {
  const duplicate = (doc.camposCustomizados || []).find(
    (item) =>
      String(item?._id || "") !== String(currentId || "") &&
      String(item?.area || "") === String(area || "") &&
      String(item?.chaveNormalizada || "") === String(chaveNormalizada || "")
  );

  if (duplicate) {
    throw createConfigError("Ja existe um campo extra com essa chave nessa area.");
  }
}

function validateQuickFilter(doc, currentId, area, field) {
  const areaDef = FILTER_AREA_DEFINITIONS[area];
  if (!areaDef) {
    throw createConfigError("Area de filtro rapido invalida.");
  }

  const fieldDef = areaDef.fields.find((item) => item.value === field);
  if (!fieldDef) {
    throw createConfigError("Campo de filtro rapido invalido para essa area.");
  }

  const duplicate = (doc.filtrosRapidos || []).find(
    (item) =>
      String(item?._id || "") !== String(currentId || "") &&
      String(item?.area || "") === area &&
      String(item?.campo || "") === field &&
      String(item?.valor || "") === ""
  );

  if (duplicate) {
    return fieldDef;
  }

  return fieldDef;
}

function validateBirthdayCampaignUniqueness(doc, currentId, nomeNormalizado) {
  const duplicate = (doc.campanhasAniversario || []).find(
    (item) =>
      String(item?._id || "") !== String(currentId || "") &&
      String(item?.nomeNormalizado || "") === String(nomeNormalizado || "")
  );

  if (duplicate) {
    throw createConfigError("Ja existe uma campanha de aniversario com esse nome.");
  }
}

function normalizeBirthdayCampaignStatus(value, fallback = "rascunho") {
  const normalized = String(value || "").trim().toLowerCase();
  return CAMPANHA_ANIVERSARIO_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeBirthdayCampaignAction(value, fallback = "exibir_dashboard") {
  const normalized = String(value || "").trim().toLowerCase();
  return CAMPANHA_ANIVERSARIO_ACOES.includes(normalized) ? normalized : fallback;
}

function normalizeBirthdayCampaignChannels(value) {
  const channels = normalizeList(value)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => CAMPANHA_ANIVERSARIO_CANAIS.includes(item));

  return channels.length ? channels : ["sistema"];
}

function normalizeBirthdayCampaignAudiences(value) {
  const audiences = normalizeList(value)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => CAMPANHA_ANIVERSARIO_PUBLICOS.includes(item));

  return audiences.length ? audiences : ["familia", "voluntario"];
}

function normalizeBirthdayChannelInput(value = {}) {
  return {
    assunto: normalizeText(value?.assunto, 140),
    aberturas: normalizeMultilineList(value?.aberturas, 18, 220),
    mensagens: normalizeMultilineList(value?.mensagens, 24, 320),
    fechamentos: normalizeMultilineList(value?.fechamentos, 18, 220),
  };
}

async function listPresenceReasons({ includeInactive = false } = {}) {
  const snapshot = await getSystemConfigSnapshot();
  const list = sortByOrder(snapshot.justificativasPresenca || []).map(mapPresenceReason);
  return includeInactive ? list : list.filter((item) => item.ativo);
}

async function listCustomFields(area, { includeInactive = false } = {}) {
  const normalizedArea = String(area || "").trim();
  const snapshot = await getSystemConfigSnapshot();
  const list = sortByOrder(snapshot.camposCustomizados || [])
    .map(mapCustomField)
    .filter((item) => !normalizedArea || item.area === normalizedArea);
  return includeInactive ? list : list.filter((item) => item.ativo);
}

async function listQuickFilters(area, { includeInactive = false } = {}) {
  const normalizedArea = String(area || "").trim();
  const snapshot = await getSystemConfigSnapshot();
  const list = sortByOrder(snapshot.filtrosRapidos || [])
    .map((item) => {
      const mapped = mapQuickFilter(item);
      return {
        ...mapped,
        href: buildQuickFilterHref(mapped.area, mapped.campo, mapped.valor),
      };
    })
    .filter((item) => !normalizedArea || item.area === normalizedArea);
  return includeInactive ? list : list.filter((item) => item.ativo);
}

async function listBirthdayCampaigns({ includeFinished = true } = {}) {
  const snapshot = await getSystemConfigSnapshot();
  const list = sortBirthdayCampaigns(snapshot.campanhasAniversario || []).map(mapBirthdayCampaign);

  if (includeFinished) return list;
  return list.filter((item) => !["encerrada"].includes(String(item?.status || "")));
}

async function getBirthdayCampaignForDashboard() {
  const campaigns = await listBirthdayCampaigns({ includeFinished: false });
  return (
    campaigns
      .filter((item) => item.status === "ativa" && item.acaoPrimaria === "exibir_dashboard")
      .sort((left, right) => {
        const priorityDiff = Number(left?.prioridade || 0) - Number(right?.prioridade || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return String(left?.nome || "").localeCompare(String(right?.nome || ""), "pt-BR");
      })[0] || null
  );
}

async function savePresenceReason(input, actorId, reasonId = null) {
  const doc = await ensureConfigDocument();
  const target =
    reasonId && doc.justificativasPresenca.id(reasonId)
      ? doc.justificativasPresenca.id(reasonId)
      : doc.justificativasPresenca.create({});

  const nome = normalizeText(input?.nome, 120);
  const nomeNormalizado = normalizeKey(input?.nome || input?.nomeNormalizado || nome, 160);
  const descricao = normalizeText(input?.descricao, 320);
  const aplicaEm = normalizeList(input?.aplicaEm).filter((item) =>
    PRESENCA_JUSTIFICATIVA_STATUSES.includes(item)
  );

  if (!nome || !nomeNormalizado) {
    throw createConfigError("Informe o nome da justificativa.");
  }

  validatePresenceReasonUniqueness(doc, target?._id || reasonId, nomeNormalizado);

  target.nome = nome;
  target.nomeNormalizado = nomeNormalizado;
  target.descricao = descricao;
  target.aplicaEm = aplicaEm.length ? aplicaEm : ["falta_justificada"];
  target.ativo = parseBoolean(input?.ativo, true);
  target.ordem = toInt(input?.ordem, 0);

  if (!reasonId) {
    doc.justificativasPresenca.push(target);
  }

  doc.atualizadoPor = actorId || null;
  doc.markModified("justificativasPresenca");
  await doc.save();

  const saved = doc.justificativasPresenca.id(String(target._id));
  return mapPresenceReason(saved);
}

async function togglePresenceReasonStatus(reasonId, ativo, actorId) {
  const doc = await ensureConfigDocument();
  const target = doc.justificativasPresenca.id(reasonId);
  if (!target) {
    throw createConfigError("Justificativa de presenca nao encontrada.", 404);
  }

  target.ativo = parseBoolean(ativo, false);
  doc.atualizadoPor = actorId || null;
  doc.markModified("justificativasPresenca");
  await doc.save();
  return mapPresenceReason(target);
}

async function saveCustomField(input, actorId, fieldId = null) {
  const doc = await ensureConfigDocument();
  const target =
    fieldId && doc.camposCustomizados.id(fieldId)
      ? doc.camposCustomizados.id(fieldId)
      : doc.camposCustomizados.create({});

  const area = String(input?.area || "").trim();
  const label = normalizeText(input?.label, 120);
  const rawKey = normalizeText(input?.chave || label, 80);
  const chaveNormalizada = normalizeKey(rawKey || label, 80);
  const tipo = CUSTOM_FIELD_TYPES.includes(String(input?.tipo || "").trim())
    ? String(input.tipo).trim()
    : "texto";
  const opcoes = tipo === "select" ? normalizeList(input?.opcoes) : [];

  if (!CUSTOM_FIELD_AREAS.includes(area)) {
    throw createConfigError("Area de campo extra invalida.");
  }
  if (!label || !chaveNormalizada) {
    throw createConfigError("Informe o nome do campo extra.");
  }

  validateCustomFieldUniqueness(doc, target?._id || fieldId, area, chaveNormalizada);

  target.area = area;
  target.label = label;
  target.chave = chaveNormalizada;
  target.chaveNormalizada = chaveNormalizada;
  target.tipo = tipo;
  target.placeholder = normalizeText(input?.placeholder, 180);
  target.ajuda = normalizeText(input?.ajuda, 240);
  target.obrigatorio = parseBoolean(input?.obrigatorio, false);
  target.ativo = parseBoolean(input?.ativo, true);
  target.ordem = toInt(input?.ordem, 0);
  target.opcoes = opcoes;

  if (!fieldId) {
    doc.camposCustomizados.push(target);
  }

  doc.atualizadoPor = actorId || null;
  doc.markModified("camposCustomizados");
  await doc.save();

  const saved = doc.camposCustomizados.id(String(target._id));
  return mapCustomField(saved);
}

async function toggleCustomFieldStatus(fieldId, ativo, actorId) {
  const doc = await ensureConfigDocument();
  const target = doc.camposCustomizados.id(fieldId);
  if (!target) {
    throw createConfigError("Campo extra nao encontrado.", 404);
  }

  target.ativo = parseBoolean(ativo, false);
  doc.atualizadoPor = actorId || null;
  doc.markModified("camposCustomizados");
  await doc.save();
  return mapCustomField(target);
}

async function saveQuickFilter(input, actorId, filterId = null) {
  const doc = await ensureConfigDocument();
  const target =
    filterId && doc.filtrosRapidos.id(filterId)
      ? doc.filtrosRapidos.id(filterId)
      : doc.filtrosRapidos.create({});

  const area = String(input?.area || "").trim();
  const nome = normalizeText(input?.nome, 100);
  const descricao = normalizeText(input?.descricao, 220);
  const campo = String(input?.campo || "").trim();
  const valor = normalizeText(input?.valor, 120);
  const areaDef = FILTER_AREA_DEFINITIONS[area];
  const fieldDef = validateQuickFilter(doc, target?._id || filterId, area, campo);
  const selectedOption = (fieldDef.options || []).find((option) => String(option.value) === valor);

  if (!nome) {
    throw createConfigError("Informe o nome do filtro rapido.");
  }
  if (!valor) {
    throw createConfigError("Informe o valor do filtro rapido.");
  }

  target.area = area;
  target.nome = nome;
  target.descricao = descricao;
  target.campo = campo;
  target.valor = valor;
  target.valorLabel = selectedOption?.label || valor;
  target.ativo = parseBoolean(input?.ativo, true);
  target.destaque = parseBoolean(input?.destaque, false);
  target.ordem = toInt(input?.ordem, 0);

  if (!filterId) {
    doc.filtrosRapidos.push(target);
  }

  doc.atualizadoPor = actorId || null;
  doc.markModified("filtrosRapidos");
  await doc.save();

  const saved = mapQuickFilter(doc.filtrosRapidos.id(String(target._id)));
  return {
    ...saved,
    href: buildQuickFilterHref(saved.area, saved.campo, saved.valor),
  };
}

async function toggleQuickFilterStatus(filterId, ativo, actorId) {
  const doc = await ensureConfigDocument();
  const target = doc.filtrosRapidos.id(filterId);
  if (!target) {
    throw createConfigError("Filtro rapido nao encontrado.", 404);
  }

  target.ativo = parseBoolean(ativo, false);
  doc.atualizadoPor = actorId || null;
  doc.markModified("filtrosRapidos");
  await doc.save();
  const saved = mapQuickFilter(target);
  return {
    ...saved,
    href: buildQuickFilterHref(saved.area, saved.campo, saved.valor),
  };
}

async function saveBirthdayCampaign(input, actorId, campaignId = null) {
  const doc = await ensureConfigDocument();
  const target =
    campaignId && doc.campanhasAniversario.id(campaignId)
      ? doc.campanhasAniversario.id(campaignId)
      : doc.campanhasAniversario.create({});

  const nome = normalizeText(input?.nome, 120);
  const nomeNormalizado = normalizeKey(input?.nome || input?.nomeNormalizado || nome, 160);
  const descricao = normalizeText(input?.descricao, 320);
  const status = normalizeBirthdayCampaignStatus(input?.status, campaignId ? target?.status : "rascunho");
  const publico = normalizeBirthdayCampaignAudiences(input?.publico);
  const canais = normalizeBirthdayCampaignChannels(input?.canais);
  const acaoPrimaria = normalizeBirthdayCampaignAction(input?.acaoPrimaria, "exibir_dashboard");
  const diasAntecedencia = Math.min(Math.max(toInt(input?.diasAntecedencia, 7), 0), 30);
  const personalizacao = {
    variarPorPerfil: parseBoolean(input?.personalizacao?.variarPorPerfil, true),
    variarPorHistorico: parseBoolean(input?.personalizacao?.variarPorHistorico, true),
    evitarRepeticaoAnual: parseBoolean(input?.personalizacao?.evitarRepeticaoAnual, true),
  };
  const mensagens = {
    sistema: normalizeBirthdayChannelInput(input?.mensagens?.sistema),
    whatsapp: normalizeBirthdayChannelInput(input?.mensagens?.whatsapp),
    email: normalizeBirthdayChannelInput(input?.mensagens?.email),
  };

  if (!nome || !nomeNormalizado) {
    throw createConfigError("Informe o nome da campanha de aniversario.");
  }

  validateBirthdayCampaignUniqueness(doc, target?._id || campaignId, nomeNormalizado);

  target.nome = nome;
  target.nomeNormalizado = nomeNormalizado;
  target.descricao = descricao;
  target.status = status;
  target.publico = publico;
  target.canais = canais;
  target.acaoPrimaria = acaoPrimaria;
  target.diasAntecedencia = diasAntecedencia;
  target.requerAprovacao = parseBoolean(input?.requerAprovacao, false);
  target.prioridade = toInt(input?.prioridade, 0);
  target.personalizacao = personalizacao;
  target.mensagens = mensagens;

  if (!campaignId) {
    doc.campanhasAniversario.push(target);
  }

  doc.atualizadoPor = actorId || null;
  doc.markModified("campanhasAniversario");
  await doc.save();

  const saved = doc.campanhasAniversario.id(String(target._id));
  return mapBirthdayCampaign(saved);
}

async function updateBirthdayCampaignStatus(campaignId, statusInput, actorId) {
  const doc = await ensureConfigDocument();
  const target = doc.campanhasAniversario.id(campaignId);

  if (!target) {
    throw createConfigError("Campanha de aniversario nao encontrada.", 404);
  }

  const status = normalizeBirthdayCampaignStatus(statusInput, "");
  if (!status) {
    throw createConfigError("Status da campanha invalido.");
  }

  target.status = status;
  doc.atualizadoPor = actorId || null;
  doc.markModified("campanhasAniversario");
  await doc.save();

  return mapBirthdayCampaign(target);
}

async function resolvePresenceReasonByKey(key, statusPresenca = "") {
  const normalizedKey = normalizeKey(key, 160);
  if (!normalizedKey) return null;

  const reasons = await listPresenceReasons({ includeInactive: false });
  return (
    reasons.find(
      (item) =>
        normalizeKey(item.nome, 160) === normalizedKey &&
        (!statusPresenca || !item.aplicaEm.length || item.aplicaEm.includes(String(statusPresenca || "").trim()))
    ) || null
  );
}

async function normalizeCustomFieldValues(area, rawValues = {}) {
  const defs = await listCustomFields(area, { includeInactive: false });
  const source = rawValues && typeof rawValues === "object" ? rawValues : {};
  const output = {};

  for (const def of defs) {
    const raw = source?.[def.chave];

    if (def.tipo === "booleano") {
      output[def.chave] = parseBoolean(raw, false);
      continue;
    }

    if (def.tipo === "numero") {
      const normalized = String(raw ?? "").trim();
      if (!normalized) {
        if (def.obrigatorio) throw createConfigError(`Informe o campo "${def.label}".`);
        continue;
      }
      const parsed = Number(normalized.replace(",", "."));
      if (!Number.isFinite(parsed)) {
        throw createConfigError(`O campo "${def.label}" precisa ser numerico.`);
      }
      output[def.chave] = parsed;
      continue;
    }

    if (def.tipo === "data") {
      const normalized = String(raw ?? "").trim();
      if (!normalized) {
        if (def.obrigatorio) throw createConfigError(`Informe o campo "${def.label}".`);
        continue;
      }
      output[def.chave] = normalized.slice(0, 10);
      continue;
    }

    const normalized = String(raw ?? "").trim();
    if (!normalized) {
      if (def.obrigatorio) throw createConfigError(`Informe o campo "${def.label}".`);
      continue;
    }

    if (def.tipo === "select" && def.opcoes.length && !def.opcoes.includes(normalized)) {
      throw createConfigError(`Selecione uma opcao valida para "${def.label}".`);
    }

    output[def.chave] = normalized;
  }

  return output;
}

function serializeCustomFieldValue(def, rawValue) {
  const value = rawValue ?? "";
  if (def?.tipo === "booleano") return value === true;
  if (def?.tipo === "numero") return value === 0 ? 0 : Number(value || 0);
  return value;
}

async function buildAdministrationSnapshot() {
  const snapshot = await getSystemConfigSnapshot();
  const justificativasPresenca = sortByOrder(snapshot.justificativasPresenca || []).map(mapPresenceReason);
  const camposCustomizados = sortByOrder(snapshot.camposCustomizados || []).map(mapCustomField);
  const filtrosRapidos = sortByOrder(snapshot.filtrosRapidos || []).map((item) => {
    const mapped = mapQuickFilter(item);
    return {
      ...mapped,
      href: buildQuickFilterHref(mapped.area, mapped.campo, mapped.valor),
    };
  });
  const campanhasAniversario = sortBirthdayCampaigns(snapshot.campanhasAniversario || []).map(mapBirthdayCampaign);

  return {
    justificativasPresenca,
    camposCustomizados,
    filtrosRapidos,
    campanhasAniversario,
    metrics: {
      justificativasAtivas: justificativasPresenca.filter((item) => item.ativo).length,
      camposAtivos: camposCustomizados.filter((item) => item.ativo).length,
      filtrosAtivos: filtrosRapidos.filter((item) => item.ativo).length,
      campanhasAtivas: campanhasAniversario.filter((item) => item.status === "ativa").length,
    },
  };
}

function getAdministrationOptions() {
  return {
    customFieldTypes: CUSTOM_FIELD_TYPES.map((value) => ({
      value,
      label: CUSTOM_FIELD_TYPE_LABELS[value] || value,
    })),
    customFieldAreas: CUSTOM_FIELD_AREAS.map((value) => ({
      value,
      label: CUSTOM_FIELD_AREA_LABELS[value] || value,
    })),
    quickFilterAreas: QUICK_FILTER_AREAS.map((value) => ({
      value,
      label: FILTER_AREA_DEFINITIONS[value]?.label || value,
      fields: FILTER_AREA_DEFINITIONS[value]?.fields || [],
    })),
    presenceStatuses: PRESENCA_JUSTIFICATIVA_STATUSES.map((value) => ({
      value,
      label: PRESENCA_STATUS_LABELS[value] || value,
    })),
    birthdayCampaignStatuses: CAMPANHA_ANIVERSARIO_STATUSES.map((value) => ({
      value,
      label: CAMPANHA_ANIVERSARIO_STATUS_LABELS[value] || value,
    })),
    birthdayCampaignAudiences: CAMPANHA_ANIVERSARIO_PUBLICOS.map((value) => ({
      value,
      label: CAMPANHA_ANIVERSARIO_PUBLICO_LABELS[value] || value,
    })),
    birthdayCampaignChannels: CAMPANHA_ANIVERSARIO_CANAIS.map((value) => ({
      value,
      label: CAMPANHA_ANIVERSARIO_CANAL_LABELS[value] || value,
    })),
    birthdayCampaignActions: CAMPANHA_ANIVERSARIO_ACOES.map((value) => ({
      value,
      label: CAMPANHA_ANIVERSARIO_ACAO_LABELS[value] || value,
    })),
  };
}

module.exports = {
  FILTER_AREA_DEFINITIONS,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_AREA_LABELS,
  CAMPANHA_ANIVERSARIO_STATUS_LABELS,
  CAMPANHA_ANIVERSARIO_PUBLICO_LABELS,
  CAMPANHA_ANIVERSARIO_CANAL_LABELS,
  CAMPANHA_ANIVERSARIO_ACAO_LABELS,
  ensureConfigDocument,
  getSystemConfigSnapshot,
  buildAdministrationSnapshot,
  getAdministrationOptions,
  listPresenceReasons,
  listCustomFields,
  listQuickFilters,
  listBirthdayCampaigns,
  getBirthdayCampaignForDashboard,
  savePresenceReason,
  togglePresenceReasonStatus,
  saveCustomField,
  toggleCustomFieldStatus,
  saveQuickFilter,
  toggleQuickFilterStatus,
  saveBirthdayCampaign,
  updateBirthdayCampaignStatus,
  normalizeCustomFieldValues,
  serializeCustomFieldValue,
  resolvePresenceReasonByKey,
  buildQuickFilterHref,
  buildBirthdayWindowLabel,
};
