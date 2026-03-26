const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createElement(overrides = {}) {
  const element = {
    hidden: false,
    disabled: false,
    value: "",
    innerHTML: "",
    textContent: "",
    className: "",
    dataset: {},
    style: {},
    attributes: {},
    elements: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    focus() {},
    reset() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] || "";
    },
    ...overrides,
  };

  if (!element.classList) {
    element.classList = {
      add() {},
      remove() {},
      toggle() {},
    };
  }

  return element;
}

function createBrowserContext() {
  const documentElements = new Map();
  const document = {
    body: { style: {} },
    defaultView: null,
    getElementById(id) {
      return documentElements.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    createElement() {
      return createElement();
    },
    createElementNS() {
      return createElement();
    },
  };

  const context = {
    console,
    Date,
    Intl,
    URLSearchParams,
    FormData,
    DOMParser: class {
      parseFromString() {
        return {
          title: "",
          querySelector() {
            return null;
          },
        };
      }
    },
    setTimeout,
    clearTimeout,
    fetch: async () => {
      throw new Error("fetch nao esperado neste teste");
    },
    document,
    history: {
      replaceState() {},
      pushState() {},
    },
    location: {
      href: "",
      pathname: "/familias",
      search: "",
      reload() {},
    },
    matchMedia() {
      return { matches: false };
    },
    appNotifyError() {},
    appNotifySuccess() {},
    alert() {},
    confirm() {
      return true;
    },
  };

  context.window = context;
  context.globalThis = context;
  document.defaultView = context;

  return {
    context: vm.createContext(context),
    documentElements,
    document,
  };
}

function registerElements(targetMap, ids) {
  ids.forEach((id) => {
    targetMap.set(id, createElement());
  });
}

function loadBrowserScript(context, relativePath) {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePath);
  const code = fs.readFileSync(absolutePath, "utf8");
  vm.runInContext(code, context, { filename: absolutePath });
}

test("createFamiliaDetalheUi escapa atributos dinamicos em dependentes e atendimentos", () => {
  const { context } = createBrowserContext();
  loadBrowserScript(context, "public/js/familias-shared.js");
  loadBrowserScript(context, "public/js/familias-detalhe-ui.js");

  const refs = {
    profissionalSelect: createElement(),
    dependenteDetalhe: createElement(),
    atendimentoDetalhe: createElement(),
    pacientesLista: createElement(),
    pacienteSelect: createElement(),
    atendimentosLista: createElement(),
    pacientesCount: createElement(),
    atendimentosCount: createElement(),
    familiaPacientesPill: createElement(),
    familiaAtendimentosPill: createElement(),
    familiaStatusPill: createElement(),
    workflowTitle: createElement(),
    workflowSubtitle: createElement(),
    workflowMainBtn: createElement(),
    workflowBackBtn: createElement(),
    workflowTabs: [],
    panelPacientes: createElement(),
    panelDependente: createElement(),
    panelHistorico: createElement(),
    panelPresencas: createElement(),
    panelAtendimento: createElement(),
    panelRegistro: createElement(),
    pacienteForm: createElement(),
    dependenteForm: createElement(),
    atendimentoForm: createElement({
      elements: {
        pacienteId: createElement(),
        profissionalId: createElement(),
        tipo: createElement(),
        dataHora: createElement(),
        resumo: createElement(),
        proximosPassos: createElement(),
      },
      reset() {},
    }),
    atendimentoSubmitBtn: createElement(),
    registroPanelTitle: createElement(),
    registroVoltarBtn: createElement(),
    dependenteEditarBtn: createElement(),
    atendimentoEditarBtn: createElement(),
  };

  refs.pacienteForm.reset = () => {};
  refs.pacienteForm.elements = { nome: createElement() };
  refs.dependenteForm.reset = () => {};
  refs.dependenteForm.elements = {
    nome: createElement(),
    dataNascimento: createElement(),
    tipoDeficiencia: createElement(),
    necessidadesApoio: createElement(),
    observacoes: createElement(),
    diagnosticoResumo: createElement(),
  };

  const state = {
    currentVoluntarios: [
      {
        _id: 'vol" onfocus="alert(1)',
        nome: '<img src=x onerror=1>',
        login: '<svg/onload=1>',
      },
    ],
    currentPacientes: [
      {
        _id: 'pac" onclick="alert(1)',
        nome: '<script>alert(1)</script>',
        tipoDeficiencia: 'outra',
        necessidadesApoio: 'apoio',
        ativo: true,
      },
    ],
    currentAtendimentos: [],
    selectedDependenteId: null,
    selectedAtendimentoId: null,
    viewFlags: {
      canTogglePatientStatus: true,
      canToggleAttendanceStatus: true,
    },
  };

  const ui = context.createFamiliaDetalheUi({
    refs,
    shared: context.FamiliasShared,
    state,
  });

  ui.renderProfissionalOptions();
  ui.renderPacientes(state.currentPacientes);
  ui.renderAtendimentos([
    {
      _id: 'atd" data-x="1',
      pacienteId: state.currentPacientes[0]._id,
      profissionalId: state.currentVoluntarios[0]._id,
      tipo: "outro",
      dataHora: "2026-03-25T12:00:00.000Z",
      resumo: '<iframe src=javascript:alert(1)>',
      ativo: true,
    },
  ]);

  assert.match(
    refs.profissionalSelect.innerHTML,
    /value="vol&quot; onfocus=&quot;alert\(1\)"/,
  );
  assert.doesNotMatch(
    refs.profissionalSelect.innerHTML,
    /value="vol" onfocus="alert\(1\)"/,
  );

  assert.match(
    refs.pacientesLista.innerHTML,
    /data-id="pac&quot; onclick=&quot;alert\(1\)"/,
  );
  assert.match(
    refs.pacientesLista.innerHTML,
    /&lt;script&gt;alert\(1\)&lt;\/script&gt;/,
  );
  assert.doesNotMatch(
    refs.pacientesLista.innerHTML,
    /data-id="pac" onclick="alert\(1\)"/,
  );
  assert.doesNotMatch(
    refs.pacientesLista.innerHTML,
    /<script>alert\(1\)<\/script>/,
  );

  assert.match(
    refs.atendimentosLista.innerHTML,
    /data-id="atd&quot; data-x=&quot;1"/,
  );
  assert.match(
    refs.atendimentosLista.innerHTML,
    /&lt;iframe src=javascript:alert\(1\)&gt;/,
  );
  assert.doesNotMatch(
    refs.atendimentosLista.innerHTML,
    /data-id="atd" data-x="1"/,
  );
  assert.doesNotMatch(
    refs.atendimentosLista.innerHTML,
    /<iframe src=javascript:alert\(1\)>/,
  );
});

test("FamiliaDetalhePage sanitiza classe de status em presencas", async () => {
  const { context, documentElements } = createBrowserContext();
  const ids = [
    "workflow-title",
    "workflow-subtitle",
    "workflow-main-btn",
    "workflow-back-btn",
    "panel-pacientes",
    "panel-dependente",
    "panel-historico",
    "panel-presencas",
    "panel-atendimento",
    "panel-registro",
    "historico-registrar-btn",
    "registro-voltar-btn",
    "registro-panel-title",
    "pacientes-lista",
    "atendimentos-lista",
    "presencas-lista",
    "presencas-resumo",
    "presencas-filter-label",
    "atendimento-detalhe",
    "atendimento-editar-btn",
    "pacientes-count",
    "atendimentos-count",
    "presencas-count",
    "familia-status-pill",
    "familia-pacientes-pill",
    "familia-atendimentos-pill",
    "familia-presencas-pill",
    "resumo-status",
    "familia-toggle-status",
    "paciente-novo-btn",
    "paciente-cancelar-btn",
    "paciente-form",
    "dependente-detalhe",
    "dependente-editar-btn",
    "dependente-form",
    "dependente-cancelar-btn",
    "atendimento-form",
    "atendimento-submit-btn",
    "atendimento-paciente",
    "atendimento-profissional",
    "resumo-nome",
    "resumo-telefone",
    "resumo-email",
    "resumo-observacoes",
    "resumo-endereco",
  ];

  registerElements(documentElements, ids);

  documentElements.get("paciente-form").reset = () => {};
  documentElements.get("paciente-form").elements = {
    nome: createElement(),
    dataNascimento: createElement(),
    tipoDeficiencia: createElement(),
    necessidadesApoio: createElement(),
    observacoes: createElement(),
    diagnosticoResumo: createElement(),
  };
  documentElements.get("dependente-form").reset = () => {};
  documentElements.get("dependente-form").elements = {
    nome: createElement(),
    dataNascimento: createElement(),
    tipoDeficiencia: createElement(),
    necessidadesApoio: createElement(),
    observacoes: createElement(),
    diagnosticoResumo: createElement(),
  };
  documentElements.get("atendimento-form").reset = () => {};
  documentElements.get("atendimento-form").elements = {
    pacienteId: createElement(),
    profissionalId: createElement(),
    tipo: createElement(),
    dataHora: createElement(),
    resumo: createElement(),
    proximosPassos: createElement(),
  };

  loadBrowserScript(context, "public/js/familias-shared.js");
  context.FamiliasShared.parseJsonScript = () => ({
    canCreatePatient: false,
    canEditPatient: false,
    canTogglePatientStatus: false,
    canCreateAttendance: false,
    canEditAttendance: false,
    canToggleAttendanceStatus: false,
    canToggleFamilyStatus: false,
  });
  context.FamiliasShared.requestJson = async () => ({
    familia: {
      responsavel: { nome: "Familia", telefone: "123" },
      endereco: {},
      ativo: true,
    },
    pacientes: [],
    atendimentos: [],
    voluntarios: [],
    presencasAgenda: [
      {
        statusPresenca: 'pendente" onclick="1',
        statusPresencaLabel: '<b>Pendente</b>',
        statusAgendamentoLabel: '<i>Agendado</i>',
        titulo: '<img src=x onerror=1>',
        inicioLabel: '<svg/onload=1>',
        pacienteNome: '<script>alert(1)</script>',
        responsavelNome: '"><img src=x onerror=1>',
        salaNome: "<iframe>",
        tipoAtendimento: "outro",
      },
    ],
  });
  context.FamiliasShared.confirmAction = async () => true;
  context.FamiliasShared.showToast = () => {};
  context.FamiliasShared.showSuccess = () => {};

  loadBrowserScript(context, "public/js/familias-detalhe-ui.js");
  loadBrowserScript(context, "public/js/familias-detalhe.js");

  const root = createElement({
    getAttribute(name) {
      return name === "data-familia-id" ? "507f1f77bcf86cd799439011" : "";
    },
    querySelectorAll() {
      return [];
    },
  });

  context.FamiliaDetalhePage.init(root);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const html = documentElements.get("presencas-lista").innerHTML;
  assert.match(html, /presenca-status-badge is-pendente-onclick-1/);
  assert.match(html, /&lt;b&gt;Pendente&lt;\/b&gt;/);
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
  assert.doesNotMatch(html, /onclick="1"/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("FamiliasListaPage escapa href e data-id dinamicos", async () => {
  const { context, documentElements } = createBrowserContext();
  const form = createElement({
    elements: {
      busca: createElement({ value: "" }),
      ativo: createElement({ value: "" }),
      parentesco: createElement({ value: "" }),
      cidade: createElement({ value: "" }),
      limit: createElement({ value: "10" }),
    },
  });

  documentElements.set("familias-filtro-form", form);
  documentElements.set("familias-limpar-filtros", createElement());
  documentElements.set("familias-table-body", createElement());
  documentElements.set("familias-paginacao", createElement());
  documentElements.set("familias-count", createElement());
  documentElements.set("familias-total-chip", createElement());
  documentElements.set("familias-active-chip", createElement());
  documentElements.set("familias-pacientes-chip", createElement());

  loadBrowserScript(context, "public/js/familias-shared.js");
  context.FamiliasShared.parseJsonScript = (id, fallback) => {
    if (id === "familias-view-flags") {
      return {
        canCreateFamily: false,
        canEditFamily: true,
        canToggleFamilyStatus: true,
      };
    }
    return fallback;
  };
  context.FamiliasShared.requestJson = async () => ({
    docs: [
      {
        _id: 'abc" onclick="alert(1)',
        ativo: true,
        pacientesAtivos: 2,
        updatedAt: "2026-03-25T12:00:00.000Z",
        responsavel: {
          nome: '<img src=x onerror=1>',
          telefone: "9999-9999",
          email: '<script>alert(1)</script>',
          parentesco: "mae",
        },
        endereco: {
          cidade: "Santos",
          estado: "SP",
        },
      },
    ],
    totalDocs: 1,
    page: 1,
    totalPages: 1,
  });
  context.FamiliasShared.showToast = () => {};

  loadBrowserScript(context, "public/js/familias-lista.js");
  context.FamiliasListaPage.init(createElement());
  await new Promise((resolve) => setTimeout(resolve, 0));

  const html = documentElements.get("familias-table-body").innerHTML;
  assert.match(
    html,
    /href="\/familias\/abc%22%20onclick%3D%22alert\(1\)"/,
  );
  assert.match(
    html,
    /data-id="abc&quot; onclick=&quot;alert\(1\)"/,
  );
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
  assert.doesNotMatch(html, /href="\/familias\/abc" onclick="alert\(1\)"/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("AdministracaoForms escapa labels e valores dinamicos dos filtros", () => {
  const { context } = createBrowserContext();
  loadBrowserScript(context, "public/js/administracao-forms.js");

  const fieldSelect = createElement();
  const valueInput = createElement();
  const valueSelect = createElement();
  const filterForm = createElement({
    elements: {
      area: createElement({ value: 'cad" autofocus="1' }),
      campo: createElement({ value: "" }),
      valor: createElement({ value: "" }),
      id: createElement({ value: "" }),
      ativo: createElement({ value: "true" }),
      ordem: createElement({ value: "0" }),
    },
    querySelector(selector) {
      if (selector === "[data-admin-filter-field]") return fieldSelect;
      if (selector === "[data-admin-filter-value-input]") return valueInput;
      if (selector === "[data-admin-filter-value-select]") return valueSelect;
      return null;
    },
    reset() {},
  });

  const root = createElement({
    querySelector(selector) {
      if (selector === "[data-admin-filter-form]") return filterForm;
      return null;
    },
  });

  const api = context.initAdministracaoForms({
    root,
    initial: {
      options: {
        quickFilterAreas: [
          {
            value: 'cad" autofocus="1',
            fields: [
              {
                value: 'status" onfocus="1',
                label: '<img src=x onerror=1>',
                type: "select",
                options: [
                  {
                    value: 'ativo"><script>alert(1)</script>',
                    label: '<svg/onload=1>',
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  api.syncFilterFields('status" onfocus="1', 'ativo"><script>alert(1)</script>');

  assert.match(
    fieldSelect.innerHTML,
    /value="status&quot; onfocus=&quot;1"/,
  );
  assert.match(fieldSelect.innerHTML, /&lt;img src=x onerror=1&gt;/);
  assert.doesNotMatch(
    fieldSelect.innerHTML,
    /value="status" onfocus="1"/,
  );

  assert.match(
    valueSelect.innerHTML,
    /value="ativo&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/,
  );
  assert.match(valueSelect.innerHTML, /&lt;svg\/onload=1&gt;/);
  assert.doesNotMatch(
    valueSelect.innerHTML,
    /value="ativo"><script>alert\(1\)<\/script>"/,
  );
});
