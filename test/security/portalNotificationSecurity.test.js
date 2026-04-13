const test = require("node:test");
const assert = require("node:assert/strict");

const { Notificacao } = require("../../schemas/core/Notificacao");
const {
  buildPortalFamilyNotificationsPageView,
  loadPortalFamilyNotificationSummary,
  markAllPortalFamilyNotificationsAsRead,
  markPortalFamilyNotificationAsRead,
  normalizeNotificationId,
  normalizeNotificationUserId,
  parseNotificationSearch,
} = require("../../services/portal/family/portalFamilyNotificationService");

test("normalizeNotificationId e normalizeNotificationUserId validam object ids", () => {
  assert.equal(
    normalizeNotificationId("507f1f77bcf86cd799439011"),
    "507f1f77bcf86cd799439011"
  );
  assert.equal(normalizeNotificationId("invalido"), "");
  assert.equal(normalizeNotificationUserId("507f1f77bcf86cd799439012"), "507f1f77bcf86cd799439012");
  assert.equal(normalizeNotificationUserId(""), "");
});

test("markPortalFamilyNotificationAsRead ignora notificationId invalido sem consultar o banco", async () => {
  const originalFindOneAndUpdate = Notificacao.findOneAndUpdate;
  let updateCalled = false;

  Notificacao.findOneAndUpdate = async () => {
    updateCalled = true;
    return null;
  };

  try {
    const result = await markPortalFamilyNotificationAsRead({
      userId: "507f1f77bcf86cd799439011",
      notificationId: "notificacao-invalida",
    });

    assert.equal(result, null);
    assert.equal(updateCalled, false);
  } finally {
    Notificacao.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("markAllPortalFamilyNotificationsAsRead ignora usuario invalido sem consultar o banco", async () => {
  const originalUpdateMany = Notificacao.updateMany;
  let updateCalled = false;

  Notificacao.updateMany = async () => {
    updateCalled = true;
    return null;
  };

  try {
    const result = await markAllPortalFamilyNotificationsAsRead("usuario-invalido");
    assert.equal(result, null);
    assert.equal(updateCalled, false);
  } finally {
    Notificacao.updateMany = originalUpdateMany;
  }
});

test("servicos de notificacao retornam vazio para userId invalido", async () => {
  const originalCountDocuments = Notificacao.countDocuments;
  const originalFind = Notificacao.find;
  let countCalled = false;
  let findCalled = false;

  Notificacao.countDocuments = async () => {
    countCalled = true;
    return 0;
  };
  Notificacao.find = () => {
    findCalled = true;
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean() {
        return [];
      },
    };
  };

  try {
    const resumo = await loadPortalFamilyNotificationSummary("usuario-invalido");
    const pagina = await buildPortalFamilyNotificationsPageView({
      userId: "usuario-invalido",
      query: {},
    });

    assert.deepEqual(resumo, {
      total: 0,
      unread: 0,
      alerts: 0,
      recent: [],
    });
    assert.equal(pagina.notificationCount, 0);
    assert.deepEqual(pagina.notificacoes, []);
    assert.equal(countCalled, false);
    assert.equal(findCalled, false);
  } finally {
    Notificacao.countDocuments = originalCountDocuments;
    Notificacao.find = originalFind;
  }
});

test("parseNotificationSearch normaliza busca e limita tamanho", () => {
  assert.equal(parseNotificationSearch("  consulta remarcada  "), "consulta remarcada");
  assert.equal(parseNotificationSearch(""), "");
  assert.equal(parseNotificationSearch("a".repeat(200)).length, 80);
});

test("buildPortalFamilyNotificationsPageView aplica filtro de busca com regex escapada", async () => {
  const originalFind = Notificacao.find;
  const originalCountDocuments = Notificacao.countDocuments;
  let capturedFilter = null;

  Notificacao.find = (filter) => {
    capturedFilter = filter;
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean() {
        return [];
      },
    };
  };

  Notificacao.countDocuments = async () => 0;

  try {
    await buildPortalFamilyNotificationsPageView({
      userId: "507f1f77bcf86cd799439011",
      query: {
        busca: "consulta (teste)",
      },
    });

    assert.ok(capturedFilter);
    assert.equal(capturedFilter.usuarioId, "507f1f77bcf86cd799439011");
    assert.ok(Array.isArray(capturedFilter.$or));
    const regexValues = capturedFilter.$or
      .map((item) => Object.values(item)[0])
      .filter((value) => value instanceof RegExp);
    assert.ok(regexValues.length >= 1);
    regexValues.forEach((regex) => {
      assert.equal(regex.flags.includes("i"), true);
      assert.equal(regex.test("consulta (teste)"), true);
    });
  } finally {
    Notificacao.find = originalFind;
    Notificacao.countDocuments = originalCountDocuments;
  }
});
