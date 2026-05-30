/**
 * One-shot import of assisteds from the client's XLSX spreadsheet into MongoDB.
 *
 * Spreadsheet structure (3 sheets: GRUPO 1, GRUPO 2, GRUPO 3):
 *   Column __EMPTY     -> nome do assistido (always present for valid rows)
 *   Column SUPORTE     -> "1" | "2" | "3" (sometimes blank)
 *   Column RESPONSÁVEL -> nome do responsável
 *   Column TELEFONE    -> telefone do responsável
 *   Column TERAPIA     -> texto livre com lista de terapias
 *
 * Usage (run inside the container so Mongo is reachable):
 *   docker exec ores-ores-1 node scripts/importarAssistidosPlanilha.js /tmp/PLANILHA.xlsx
 *   docker exec ores-ores-1 node scripts/importarAssistidosPlanilha.js /tmp/PLANILHA.xlsx --dry-run
 *
 * Idempotency:
 *   Skips rows whose (lower-cased nome + lower-cased responsavel.nome) already
 *   exist as an Assistido. Safe to re-run.
 */

const path = require("path");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

const { Assistido } = require("../schemas/social/Assistido");

const DRY_RUN = process.argv.includes("--dry-run");
const fileArg = process.argv.find(
  (a) => a.endsWith(".xlsx") || a.endsWith(".xls")
);
if (!fileArg) {
  console.error("Uso: node importarAssistidosPlanilha.js <arquivo.xlsx> [--dry-run]");
  process.exit(2);
}

const FILE_PATH = path.resolve(fileArg);

// ── Helpers ────────────────────────────────────────────────────────────────

const PARTICULAS_MINUSC = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "del",
  "della",
  "von",
  "van",
]);

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
      // Preserve simple apostrophes (d'Avila)
      return word
        .split("'")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("'");
    })
    .join(" ");
}

function normalizePhoneDigits(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return digits;
  // Some rows might have country code 55 — strip if present
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  // Anything else: return raw digits so reviewer sees what's wrong; will fail validation later
  return digits;
}

function pickSuporte(raw) {
  const v = String(raw || "").trim();
  if (v === "1" || v === "2" || v === "3") return v;
  return null;
}

function buildObservacoes(terapiaTexto) {
  const t = String(terapiaTexto || "").trim().replace(/\s+/g, " ");
  if (!t) return null;
  return `Terapias: ${t}`;
}

function getMongoUri() {
  const dbHost = process.env.DB_HOST || "127.0.0.1";
  const dbPort = process.env.DB_PORT || "27017";
  return (
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    `mongodb://${dbHost}:${dbPort}/ORES`
  );
}

// ── Read spreadsheet ───────────────────────────────────────────────────────

function readRows() {
  const wb = xlsx.readFile(FILE_PATH);
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const raw = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
    for (const r of raw) {
      const nome = String(r.__EMPTY || "").trim();
      if (!nome) continue;
      rows.push({
        sheet: sheetName,
        nome,
        suporte: pickSuporte(r.SUPORTE),
        responsavel: String(r["RESPONSÁVEL"] || "").trim(),
        telefone: String(r.TELEFONE || "").trim(),
        terapia: String(r.TERAPIA || "").trim(),
      });
    }
  }
  return rows;
}

// ── Build assistido doc ────────────────────────────────────────────────────

function buildDoc(row) {
  const nome = toTitleCase(row.nome);
  const responsavelNome = toTitleCase(row.responsavel);
  const telefone = normalizePhoneDigits(row.telefone);

  return {
    nome,
    suporte: row.suporte,
    nacionalidade: "Brasileira",
    responsavel: {
      nome: responsavelNome || undefined,
      telefone: telefone || undefined,
      ePrincipalResponsavel: responsavelNome ? "sim" : null,
    },
    observacoes: buildObservacoes(row.terapia),
    status: "rascunho",
    etapaConcluida: 1,
    ativo: true,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\n📂 Lendo planilha: ${FILE_PATH}`);
  console.log(`   Modo: ${DRY_RUN ? "DRY-RUN (não grava)" : "GRAVAÇÃO REAL"}\n`);

  const rows = readRows();
  console.log(`📋 Linhas com nome preenchido: ${rows.length}\n`);

  if (!DRY_RUN) {
    console.log("🔌 Conectando ao MongoDB...");
    await mongoose.connect(getMongoUri(), { maxPoolSize: 5 });
    console.log("✅ Conectado.\n");
  }

  const counts = { criados: 0, pulados: 0, erros: 0 };
  const erros = [];

  for (const row of rows) {
    const doc = buildDoc(row);

    const exists = !DRY_RUN
      ? await Assistido.findOne({
          nome: new RegExp(`^${doc.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          "responsavel.nome": new RegExp(
            `^${(doc.responsavel.nome || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        }).lean()
      : null;

    if (exists) {
      counts.pulados += 1;
      console.log(`⏭️  [${row.sheet}] já existe: ${doc.nome}`);
      continue;
    }

    if (DRY_RUN) {
      counts.criados += 1;
      console.log(
        `➕ [${row.sheet}] ${doc.nome} | resp: ${doc.responsavel.nome || "—"}` +
          ` | tel: ${doc.responsavel.telefone || "—"}` +
          ` | suporte: ${doc.suporte || "—"}`
      );
      continue;
    }

    try {
      await Assistido.create(doc);
      counts.criados += 1;
      console.log(`✅ [${row.sheet}] criado: ${doc.nome}`);
    } catch (err) {
      counts.erros += 1;
      erros.push({ nome: doc.nome, erro: err.message });
      console.log(`❌ [${row.sheet}] erro em ${doc.nome}: ${err.message}`);
    }
  }

  console.log("\n──────────────────────────────────────────");
  console.log(`Total na planilha: ${rows.length}`);
  console.log(`Criados:           ${counts.criados}`);
  console.log(`Pulados (já existem): ${counts.pulados}`);
  console.log(`Erros:             ${counts.erros}`);
  console.log("──────────────────────────────────────────");

  if (erros.length) {
    console.log("\nDetalhe dos erros:");
    for (const e of erros) console.log(`  - ${e.nome}: ${e.erro}`);
  }

  if (!DRY_RUN) await mongoose.connection.close().catch(() => {});
  process.exit(0);
})().catch(async (err) => {
  console.error("\n💥 Falha geral:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
