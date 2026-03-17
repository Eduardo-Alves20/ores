const {
  ConfiguracaoSistema,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_AREAS,
  QUICK_FILTER_AREAS,
  PRESENCA_JUSTIFICATIVA_STATUSES,
} = require("../schemas/core/ConfiguracaoSistema");

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
          { value: "admin", label: "admin_alento" },
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

async function ensureConfigDocument() {
  let doc = await ConfiguracaoSistema.findOne({ chave: "default" });
  if (doc) return doc;

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

  return {
    justificativasPresenca,
    camposCustomizados,
    filtrosRapidos,
    metrics: {
      justificativasAtivas: justificativasPresenca.filter((item) => item.ativo).length,
      camposAtivos: camposCustomizados.filter((item) => item.ativo).length,
      filtrosAtivos: filtrosRapidos.filter((item) => item.ativo).length,
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
  };
}

module.exports = {
  FILTER_AREA_DEFINITIONS,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_AREA_LABELS,
  ensureConfigDocument,
  getSystemConfigSnapshot,
  buildAdministrationSnapshot,
  getAdministrationOptions,
  listPresenceReasons,
  listCustomFields,
  listQuickFilters,
  savePresenceReason,
  togglePresenceReasonStatus,
  saveCustomField,
  toggleCustomFieldStatus,
  saveQuickFilter,
  toggleQuickFilterStatus,
  normalizeCustomFieldValues,
  serializeCustomFieldValue,
  resolvePresenceReasonByKey,
  buildQuickFilterHref,
};
