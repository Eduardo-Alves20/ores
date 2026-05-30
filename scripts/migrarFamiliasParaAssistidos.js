const path = require("path");
const mongoose = require("mongoose");

const { Assistido, SEXO_BIOLOGICO, COR_RACA, PERMISSAO_CONTATO } = require("../schemas/social/Assistido");
const Familia = require("../schemas/social/Familia");

const DRY_RUN = process.argv.includes("--dry-run");

const PARTICULAS_MINUSC = new Set(["de", "da", "do", "das", "dos", "e", "di", "del", "della", "von", "van"]);

function toTitleCase(raw) {
  if (!raw) return "";
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, idx) => {
      if (!word) return word;
      if (idx > 0 && PARTICULAS_MINUSC.has(word)) return word;
      return word
        .split("'")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("'");
    })
    .join(" ");
}

function stripToDigits(value) {
  const d = String(value || "").replace(/\D/g, "");
  return d || null;
}

function normalizePhone(value) {
  const d = stripToDigits(value);
  if (!d) return null;
  if (d.length === 12 && d.startsWith("55")) return d.slice(2);
  if (d.length === 13 && d.startsWith("55")) return d.slice(2);
  return d;
}

function parseDateLoose(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapWhatsApp(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "sim" || v === "true") return true;
  if (v === "nao" || v === "não" || v === "false") return false;
  return null;
}

function mapPermissaoContato(value) {
  const v = String(value || "").trim().toLowerCase();
  const direct = { qualquer: "qualquer_hora", qualquer_hora: "qualquer_hora", manha: "somente_manha", somente_manha: "somente_manha", tarde: "somente_tarde", somente_tarde: "somente_tarde", nao_ligar: "nao_ligar" };
  const mapped = direct[v] || null;
  return mapped && PERMISSAO_CONTATO.includes(mapped) ? mapped : null;
}

function mapEnum(value, allowed) {
  const v = String(value || "").trim().toLowerCase();
  return allowed.includes(v) ? v : null;
}

function mapEndereco(end = {}) {
  return {
    cep: stripToDigits(end.cep),
    logradouro: String(end.rua || "").trim() || null,
    numero: String(end.numero || "").trim() || null,
    complemento: String(end.complemento || "").trim() || null,
    bairro: String(end.bairro || "").trim() || null,
    cidade: String(end.cidade || "").trim() || null,
    estado: String(end.estado || "").trim() || null,
  };
}

function buildAssistidoFromFamilia(fam) {
  const r = fam.responsavel || {};
  const ce = fam.camposExtras instanceof Map ? Object.fromEntries(fam.camposExtras) : fam.camposExtras || {};

  const nomeAssistido = toTitleCase(r.nome);
  const telefone = normalizePhone(r.telefone);

  const doc = {
    nome: nomeAssistido,
    cpf: stripToDigits(ce.cpf),
    rg: String(ce.rg || "").trim() || null,
    orgaoEmissor: String(ce.orgao_emissor || "").trim() || null,
    dataNascimento: parseDateLoose(ce.data_nascimento),
    sexoBiologico: mapEnum(ce.sexo_biologico, SEXO_BIOLOGICO),
    corRaca: mapEnum(ce.cor_raca, COR_RACA),
    naturalidade: String(ce.naturalidade || "").trim() || null,
    nacionalidade: String(ce.nacionalidade || "Brasileira").trim(),
    telefonePrincipal: telefone,
    telefoneSecundario: normalizePhone(ce.telefone_secundario),
    isWhatsApp: mapWhatsApp(ce.is_whatsapp),
    email: String(r.email || "").trim().toLowerCase() || null,
    permissaoContato: mapPermissaoContato(ce.permissao_contato),
    responsavel: {
      parentesco: String(r.parentesco || "").trim() || null,
      nome: toTitleCase(r.nomeResponsavel) || null,
      cpf: stripToDigits(r.cpfResponsavel),
      dataNascimento: parseDateLoose(r.dataNascimentoResponsavel),
      telefone,
      email: String(r.emailResponsavel || "").trim().toLowerCase() || null,
      ePrincipalResponsavel: "sim",
    },
    endereco: mapEndereco(fam.endereco),
    observacoes: String(fam.observacoes || "").trim() || null,
    camposExtras: ce,
    anexos: Array.isArray(fam.anexos) ? fam.anexos : [],
    status: "rascunho",
    etapaConcluida: 1,
    ativo: fam.ativo !== false,
    criadoPor: fam.criadoPor || null,
    atualizadoPor: fam.atualizadoPor || null,
  };

  return doc;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

(async () => {
  const dbHost = process.env.DB_HOST || "127.0.0.1";
  const dbPort = process.env.DB_PORT || "27017";
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || `mongodb://${dbHost}:${dbPort}/ORES`;

  console.log(`\nMigrando Familias -> Assistidos`);
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (nao grava)" : "GRAVACAO REAL"}\n`);

  await mongoose.connect(uri, { maxPoolSize: 5 });

  const familias = await Familia.find({}).lean();
  console.log(`Familias encontradas: ${familias.length}\n`);

  const counts = { criados: 0, pulados: 0, erros: 0 };
  const erros = [];

  for (const fam of familias) {
    const doc = buildAssistidoFromFamilia(fam);

    if (!doc.nome) {
      counts.pulados += 1;
      console.log(`PULADO (sem nome): familia ${fam._id}`);
      continue;
    }

    const existing = await Assistido.findOne({
      nome: new RegExp(`^${escapeRegex(doc.nome)}$`, "i"),
      "responsavel.nome": doc.responsavel.nome
        ? new RegExp(`^${escapeRegex(doc.responsavel.nome)}$`, "i")
        : { $in: [null, ""] },
    }).lean();

    if (existing) {
      counts.pulados += 1;
      console.log(`PULADO (ja existe): ${doc.nome}`);
      continue;
    }

    if (DRY_RUN) {
      counts.criados += 1;
      console.log(`CRIA: ${doc.nome} | resp: ${doc.responsavel.nome || "-"} | tel: ${doc.telefonePrincipal || "-"} | extras: ${Object.keys(doc.camposExtras || {}).length}`);
      continue;
    }

    try {
      await Assistido.create(doc);
      counts.criados += 1;
      console.log(`OK: ${doc.nome}`);
    } catch (err) {
      counts.erros += 1;
      erros.push({ nome: doc.nome, erro: err.message });
      console.log(`ERRO: ${doc.nome} -> ${err.message}`);
    }
  }

  console.log("\n------------------------------------------");
  console.log(`Total familias:  ${familias.length}`);
  console.log(`Criados:         ${counts.criados}`);
  console.log(`Pulados:         ${counts.pulados}`);
  console.log(`Erros:           ${counts.erros}`);
  console.log("------------------------------------------");

  if (erros.length) {
    console.log("\nErros:");
    erros.forEach((e) => console.log(`  - ${e.nome}: ${e.erro}`));
  }

  await mongoose.connection.close().catch(() => {});
  process.exit(0);
})().catch(async (err) => {
  console.error("\nFalha geral:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
