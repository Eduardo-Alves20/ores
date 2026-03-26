const fs = require("fs");
const path = require("path");
const { logSanitizedError } = require("../services/security/logSanitizerService");

const DEFAULT_MESSAGES = {
  400: "Ocorreu um erro ao processar sua requisicao.",
  403: "Voce nao tem permissao para acessar esta pagina.",
  404: "A pagina que voce esta procurando nao foi encontrada.",
  413: "A requisicao excede o tamanho maximo permitido.",
  500: "Ocorreu um erro interno no servidor.",
};

function resolveErrorStatus(err) {
  if (err?.type === "entity.too.large") return 413;
  const status = Number(err?.status || err?.statusCode || 500);
  if (status >= 400 && status < 600) return status;
  return 500;
}

function wantsHtml(req) {
  return typeof req?.accepts === "function" && !!req.accepts("html");
}

function resolvePublicErrorMessage(err, status) {
  if (err?.publicMessage) return err.publicMessage;
  if (status >= 500) return DEFAULT_MESSAGES[500];
  if (status === 413 || err?.type === "entity.too.large") {
    return DEFAULT_MESSAGES[413];
  }
  if (err?.message) return err.message;
  return DEFAULT_MESSAGES[status] || DEFAULT_MESSAGES[500];
}

function createNotFoundHandler() {
  return (req, res, next) => {
    const err = new Error("Pagina nao encontrada");
    err.status = 404;
    err.publicMessage = DEFAULT_MESSAGES[404];
    next(err);
  };
}

function createErrorHandler({ baseDir, ambiente } = {}) {
  const appBaseDir = baseDir || process.cwd();
  const showStack = String(ambiente || "").trim().toLowerCase() !== "prod";

  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    logSanitizedError("[server error]", err, {
      method: req?.method || "",
      url: req?.originalUrl || req?.url || "",
      userId: req?.session?.user?.id || null,
    });

    const status = resolveErrorStatus(err);
    const message = resolvePublicErrorMessage(err, status);

    if (!wantsHtml(req)) {
      return res.status(status).json({
        message: [message],
        status,
      });
    }

    const view =
      status === 400
        ? "pages/errors/400"
        : status === 403
          ? "pages/errors/403"
          : status === 404
            ? "pages/errors/404"
            : "pages/errors/500";

    const viewPath = path.join(appBaseDir, "views", `${view}.ejs`);

    if (fs.existsSync(viewPath)) {
      return res.status(status).render(view, {
        status,
        message,
        req,
        err: showStack ? err : {},
        layout: "partials/login.ejs",
      });
    }

    return res.status(status).type("html").send(`
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Erro ${status}</title>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 24px;">
    <h1>Erro ${status}</h1>
    <p>${message}</p>
  </body>
</html>
`);
  };
}

module.exports = {
  DEFAULT_MESSAGES,
  createErrorHandler,
  createNotFoundHandler,
  resolveErrorStatus,
  resolvePublicErrorMessage,
};
