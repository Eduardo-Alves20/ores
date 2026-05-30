"use strict";

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const FuncaoAcesso = require("../schemas/core/FuncaoAcesso");
const { PERMISSIONS } = require("../config/permissions");

const FUNCOES = [
  {
    nome: "Terapeuta",
    slug: "terapeuta",
    descricao:
      "Profissionais de atendimento terapeutico (Psicomotricidade, Psicologia, Psicopedagogo, Fonoaudiologia, Musicoterapia). Visualizam apenas os assistidos vinculados ao proprio atendimento. Agenda somente leitura.",
    permissoes: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ASSISTIDOS_VIEW,
      PERMISSIONS.ATENDIMENTOS_VIEW,
      PERMISSIONS.ATENDIMENTOS_CREATE,
      PERMISSIONS.ATENDIMENTOS_UPDATE,
      PERMISSIONS.ASSISTIDOS_SCOPE_OWN,
      PERMISSIONS.AGENDA_VIEW,
      PERMISSIONS.NOTIFICACOES_VIEW,
    ],
  },
  {
    nome: "Assistencia Social",
    slug: "assistencia-social",
    descricao:
      "Servico Social. Realiza cadastros, anamnese e acompanhamento amplo das familias e assistidos.",
    permissoes: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ASSISTIDOS_VIEW,
      PERMISSIONS.ASSISTIDOS_CREATE,
      PERMISSIONS.ASSISTIDOS_UPDATE,
      PERMISSIONS.ASSISTIDOS_STATUS,
      PERMISSIONS.ATENDIMENTOS_VIEW,
      PERMISSIONS.ATENDIMENTOS_CREATE,
      PERMISSIONS.ATENDIMENTOS_UPDATE,
      PERMISSIONS.ATENDIMENTOS_STATUS,
      PERMISSIONS.AGENDA_VIEW,
      PERMISSIONS.AGENDA_VIEW_ALL,
      PERMISSIONS.RELATORIOS_VIEW,
      PERMISSIONS.BUSCA_GLOBAL,
      PERMISSIONS.NOTIFICACOES_VIEW,
    ],
  },
];

async function seed() {
  const databaseUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DB_URI ||
    `mongodb://${process.env.DB_HOST || "127.0.0.1"}:${process.env.DB_PORT || "27017"}/ORES`;
  await mongoose.connect(databaseUri);
  console.log("Conectado ao banco.");

  for (const funcao of FUNCOES) {
    const resultado = await FuncaoAcesso.findOneAndUpdate(
      { slug: funcao.slug },
      {
        $set: {
          nome: funcao.nome,
          descricao: funcao.descricao,
          permissoes: funcao.permissoes,
          ativo: true,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    console.log(`Upsert: ${resultado.nome} (${resultado._id})`);
  }

  await mongoose.disconnect();
  console.log("Feito.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
