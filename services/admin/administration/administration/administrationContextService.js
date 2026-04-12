const { AgendaSala } = require("../../../../schemas/social/AgendaSala");
const {
  buildAdministrationSnapshot,
  getAdministrationOptions,
} = require("../../../shared/systemConfigService");

function getAdministrationActorId(req) {
  return req?.session?.user?.id || null;
}

function mapAdministrationRoom(doc) {
  return {
    _id: String(doc?._id || ""),
    nome: String(doc?.nome || ""),
    descricao: String(doc?.descricao || ""),
    ativo: doc?.ativo !== false,
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
  };
}

async function loadAdministrationPageContext() {
  const [snapshot, salas] = await Promise.all([
    buildAdministrationSnapshot(),
    AgendaSala.find({})
      .sort({ ativo: -1, nome: 1 })
      .lean(),
  ]);

  return {
    snapshot,
    salas: (salas || []).map(mapAdministrationRoom),
    options: getAdministrationOptions(),
  };
}

function buildAdministrationPageView(adminSnapshot) {
  return {
    title: "Administracao",
    sectionTitle: "Administracao",
    navKey: "admin",
    layout: "partials/app.ejs",
    pageClass: "page-administracao",
    extraCss: ["/css/administracao.css"],
    extraJs: [
      "/js/administracao-shared.js",
      "/js/administracao-forms.js",
      "/js/administracao-actions.js",
      "/js/administracao.js",
    ],
    adminSnapshot,
  };
}

module.exports = {
  buildAdministrationPageView,
  getAdministrationActorId,
  loadAdministrationPageContext,
  mapAdministrationRoom,
};
