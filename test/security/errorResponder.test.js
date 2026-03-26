const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_MESSAGES,
  createErrorHandler,
  createNotFoundHandler,
} = require("../../middlewares/errorResponder");

function createMockResponse() {
  return {
    headersSent: false,
    statusCode: 200,
    body: null,
    rendered: null,
    viewName: null,
    contentType: null,
    sent: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    render(viewName, rendered) {
      this.viewName = viewName;
      this.rendered = rendered;
      return this;
    },
    type(contentType) {
      this.contentType = contentType;
      return this;
    },
    send(payload) {
      this.sent = payload;
      return this;
    },
  };
}

function withMutedConsoleError(run) {
  const original = console.error;
  console.error = () => {};

  try {
    return run();
  } finally {
    console.error = original;
  }
}

test("error handler nao vaza detalhe interno em erro 500 para API", () => {
  const handler = createErrorHandler({ baseDir: process.cwd(), ambiente: "prod" });
  const req = {
    accepts(format) {
      return format === "json";
    },
  };
  const res = createMockResponse();

  withMutedConsoleError(() => {
    handler(new Error("falha interna do banco"), req, res, () => {});
  });

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    message: [DEFAULT_MESSAGES[500]],
    status: 500,
  });
});

test("error handler preserva mensagem publica em erro 400 de API", () => {
  const handler = createErrorHandler({ baseDir: process.cwd(), ambiente: "prod" });
  const req = {
    accepts(format) {
      return format === "json";
    },
  };
  const res = createMockResponse();
  const err = new Error("Campo obrigatorio ausente.");
  err.status = 400;

  withMutedConsoleError(() => {
    handler(err, req, res, () => {});
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    message: ["Campo obrigatorio ausente."],
    status: 400,
  });
});

test("error handler trata payload acima do limite como 413 padronizado", () => {
  const handler = createErrorHandler({ baseDir: process.cwd(), ambiente: "prod" });
  const req = {
    accepts(format) {
      return format === "json";
    },
  };
  const res = createMockResponse();
  const err = new Error("request entity too large");
  err.type = "entity.too.large";

  withMutedConsoleError(() => {
    handler(err, req, res, () => {});
  });

  assert.equal(res.statusCode, 413);
  assert.deepEqual(res.body, {
    message: [DEFAULT_MESSAGES[413]],
    status: 413,
  });
});

test("not found middleware cria erro 404 com mensagem publica padrao", () => {
  const middleware = createNotFoundHandler();
  let captured = null;

  middleware({}, {}, (err) => {
    captured = err;
  });

  assert.ok(captured);
  assert.equal(captured.status, 404);
  assert.equal(captured.publicMessage, DEFAULT_MESSAGES[404]);
});
