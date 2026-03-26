const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createBrowserContext() {
  const document = {
    body: { style: {} },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    createElement() {
      return {
        appendChild() {},
        addEventListener() {},
        setAttribute() {},
        classList: { add() {}, remove() {} },
        dataset: {},
        style: {},
        textContent: "",
        innerHTML: "",
      };
    },
    createElementNS() {
      return {
        appendChild() {},
        addEventListener() {},
        setAttribute() {},
        classList: { add() {}, remove() {} },
        style: {},
        textContent: "",
      };
    },
  };

  const context = {
    console,
    Date,
    Intl,
    URLSearchParams,
    FormData,
    setTimeout,
    clearTimeout,
    fetch: async () => {
      throw new Error("fetch nao esperado neste teste");
    },
    document,
    matchMedia() {
      return { matches: false };
    },
    history: {
      replaceState() {},
      pushState() {},
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

  return vm.createContext(context);
}

function loadBrowserScript(context, relativePath) {
  const absolutePath = path.resolve(
    __dirname,
    "..",
    "..",
    relativePath,
  );
  const code = fs.readFileSync(absolutePath, "utf8");
  vm.runInContext(code, context, { filename: absolutePath });
}

test("AgendaShared.sanitizeClassToken neutraliza fragmentos perigosos", () => {
  const context = createBrowserContext();
  loadBrowserScript(context, "public/js/agenda-shared.js");

  assert.equal(
    context.AgendaShared.sanitizeClassToken('agendado" onclick="alert(1)', "fallback"),
    "agendado-onclick-alert-1",
  );
  assert.equal(
    context.AgendaShared.sanitizeClassToken("<svg/onload=1>", "seguro"),
    "svg-onload-1",
  );
  assert.equal(context.AgendaShared.sanitizeClassToken("", "seguro"), "seguro");
});

test("AgendaCalendar.renderSelectedDay escapa payloads dinamicos do evento", () => {
  const context = createBrowserContext();
  loadBrowserScript(context, "public/js/agenda-shared.js");
  loadBrowserScript(context, "public/js/agenda-calendar.js");

  const diaTitulo = { textContent: "" };
  const diaLista = { innerHTML: "" };

  const calendar = context.AgendaCalendar.create({
    elements: {
      diaTitulo,
      diaLista,
      mesTitulo: { textContent: "" },
      mesPickerMes: { dataset: {}, value: "" },
      mesPickerAno: { dataset: {}, value: "" },
    },
    state: {
      viewDate: new Date("2026-03-01T12:00:00.000Z"),
      selectedDay: "2026-03-10",
      eventos: [
        {
          _id: "507f1f77bcf86cd799439011",
          inicio: "2026-03-10T13:00:00.000Z",
          fim: "2026-03-10T14:00:00.000Z",
          tipoAtendimento: 'visita"><img src=x onerror=1>',
          titulo: '<img src=x onerror=alert(1)>',
          responsavel: { nome: '<svg/onload=alert(1)>' },
          paciente: { nome: '<script>alert(1)</script>' },
          familia: { responsavelNome: '<iframe src=javascript:alert(1)>' },
          sala: { nome: '<b>Sala</b>' },
          local: '"><img src=x onerror=1>',
          statusAgendamento: 'agendado" data-bad="1',
          statusAgendamentoLabel: "<b>Agendado</b>",
          statusPresenca: 'pendente" onclick="1',
          statusPresencaLabel: "<i>Pendente</i>",
          presencaRegistradaEmLabel: "<img>",
          presencaRegistradaPor: { nome: "<script>" },
          presencaObservacao: "<audio oncanplay=alert(1)>",
          ativo: true,
        },
      ],
      eventosById: new Map(),
      openPopoverDay: null,
    },
    attendance: {
      renderWeeklyPresence() {},
      canMoveEvent() {
        return false;
      },
      canManageAttendance() {
        return true;
      },
      canEditEvent() {
        return true;
      },
      canToggleEventStatus() {
        return true;
      },
      buildAttendanceQuickActions() {
        return '<div class="agenda-safe-actions"></div>';
      },
    },
    shared: context.AgendaShared,
  });

  calendar.renderSelectedDay();

  assert.match(diaLista.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(diaLista.innerHTML, /&lt;svg\/onload=alert\(1\)&gt;/);
  assert.match(diaLista.innerHTML, /status-agendado-data-bad-1/);
  assert.match(diaLista.innerHTML, /status-pendente-onclick-1/);
  assert.doesNotMatch(diaLista.innerHTML, /<img src=x onerror=alert\(1\)>/);
  assert.doesNotMatch(diaLista.innerHTML, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(diaLista.innerHTML, /data-bad="1"/);
});

test("AgendaForm escapa labels dinamicos em selects e cards", () => {
  const context = createBrowserContext();
  loadBrowserScript(context, "public/js/agenda-shared.js");
  loadBrowserScript(context, "public/js/agenda-form.js");

  const salaSelect = { innerHTML: "", required: false, value: "" };
  const salaLabel = { textContent: "" };
  const salaHint = { textContent: "", dataset: {} };
  const salasLista = { innerHTML: "" };
  const tipoSelect = { innerHTML: "", value: "outro" };
  const responsavelSelect = { innerHTML: "", disabled: false, value: "" };
  const responsavelFiltro = { innerHTML: "", disabled: false, value: "" };
  const familiaSelect = { innerHTML: "" };
  const pacienteSelect = { innerHTML: "" };

  const formModule = context.AgendaForm.create({
    elements: {
      modalBackdrop: { hidden: true },
      salasBackdrop: { hidden: true },
      salaSelect,
      salaLabel,
      salaHint,
      salasLista,
      tipoSelect,
      responsavelSelect,
      responsavelFiltro,
      familiaSelect,
      pacienteSelect,
      form: {
        elements: {
          data: { value: "" },
          hora: { value: "" },
          salaId: { value: "" },
        },
      },
    },
    permissions: {
      canAssignOthers: true,
      canViewAll: false,
      canManageRooms: true,
    },
    roomRequiredTypes: [],
    slotMinutes: 30,
    state: {
      profissionais: [
        {
          _id: "507f1f77bcf86cd799439011",
          nome: '<img src=x onerror=alert(1)>',
          perfil: '<svg/onload=1>',
        },
      ],
      salasCatalogo: [
        {
          _id: "507f1f77bcf86cd799439012",
          nome: '<script>alert(1)</script>',
          descricao: '"><img src=x onerror=1>',
          ativo: true,
        },
      ],
      availableSalas: [],
      familias: [],
      salaRequestId: 0,
    },
    tiposAtendimento: ["outro", 'visita"><img src=x onerror=1>'],
    user: {
      id: "507f1f77bcf86cd799439013",
      nome: '<b>Meu calendario</b>',
    },
    attendance: {},
    shared: context.AgendaShared,
  });

  formModule.setResponsavelOptions();
  formModule.setFiltroProfissionais();
  formModule.renderSalasCatalogo();
  formModule.setTipoOptions();
  formModule.fillPatientsOptions([
    {
      _id: "507f1f77bcf86cd799439014",
      nome: '<iframe src=javascript:alert(1)>',
    },
  ]);

  assert.match(
    responsavelSelect.innerHTML,
    /&lt;img src=x onerror=alert\(1\)&gt;/,
  );
  assert.match(responsavelSelect.innerHTML, /&lt;svg\/onload=1&gt;/);
  assert.doesNotMatch(
    responsavelSelect.innerHTML,
    /<img src=x onerror=alert\(1\)>/,
  );

  assert.match(responsavelFiltro.innerHTML, /&lt;b&gt;Meu calendario&lt;\/b&gt;/);
  assert.doesNotMatch(responsavelFiltro.innerHTML, /<b>Meu calendario<\/b>/);

  assert.match(salasLista.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(
    salasLista.innerHTML,
    /&quot;&gt;&lt;img src=x onerror=1&gt;/,
  );
  assert.doesNotMatch(salasLista.innerHTML, /<script>alert\(1\)<\/script>/);

  assert.match(
    tipoSelect.innerHTML,
    /value="visita&quot;&gt;&lt;img src=x onerror=1&gt;"/,
  );
  assert.doesNotMatch(
    tipoSelect.innerHTML,
    /value="visita"><img src=x onerror=1>"/,
  );

  assert.match(
    pacienteSelect.innerHTML,
    /&lt;iframe src=javascript:alert\(1\)&gt;/,
  );
  assert.doesNotMatch(
    pacienteSelect.innerHTML,
    /<iframe src=javascript:alert\(1\)>/,
  );
});
