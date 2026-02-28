require("dotenv").config();
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const flash = require("express-flash");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const http = require("http");

const app = express();

const {
  PORT,
  HOST,
  hostForUrl,
  AMBIENTE,
  isProdLike,
  sessionParser,
} = require("./config/env");


const { loadOrCreateCookieParserKey } = require("./config/config");
const cookieParserKey = loadOrCreateCookieParserKey();

const MONGO_FALLBACK = `mongodb://${DB_HOST || "localhost"}:${DB_PORT || "27017"}/ALENTO`;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || MONGO_FALLBACK;

/* Mongo */
mongoose.set("bufferCommands", false);

async function connectDb() {
  if (!MONGO_URI) {
    console.warn("MONGO_URI não definido. Subindo sem banco…");
    return false;
  }
  await mongoose.connect(MONGO_URI, { maxPoolSize: 10 });
  await mongoose.connection.asPromise();
  console.log("Mongo conectado");
  return true;
}


/* View engine */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);

// layout padrão (você pode manter login aqui; cada render pode sobrescrever)
app.set("layout", "layouts/login.ejs");

/* Middlewares */
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));
app.use(cookieParser(cookieParserKey));
app.use(compression());
app.use(sessionParser);
app.use(flash());

/* Static */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "public", "assets")));
app.use("/css", express.static(path.join(__dirname, "public", "css")));
app.use("/js", express.static(path.join(__dirname, "public", "js")));
app.use("/static", express.static(path.join(__dirname, "public")));


app.use((req, res, next) => {
  res.locals.ambiente = AMBIENTE;
  res.locals.lastCommitDate = `Última atualização em: ${new Date().toLocaleString("pt-BR")}`;
  res.locals.alert = null;

  const sess = req.session || {};
  const sessUser = sess.userdata || null;

  res.locals.user = sessUser;
  res.locals.username = sessUser?.username || sess.username || null;

  next();
});


/* Logger */
app.use(
  morgan((tokens, req, res) => {
    const date = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo"
    });
    const usuario =
      req?.session?.userdata?.username ||
      req?.session?.username ||
      "Desconhecido";
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    return [
      `[${date}]`,
      `IP: ${clientIp}`,
      `USER: ${usuario} |`,
      `${tokens.method(req, res)}`,
      `URL: ${tokens.url(req, res)} |`,
      `Status: ${tokens.status(req, res)}`,
      `Tempo: ${tokens["response-time"](req, res)} ms`
    ].join(" ");
  })
);

/* Rotas + erros */
function mountRoutes() {
  const routes = require("./routes");
  app.use("/", routes);

  // 404 - nenhuma rota bateu
  app.use((req, res, next) => {
    const err = new Error("Página não encontrada");
    err.status = 404;
    err.publicMessage = "A página que você está procurando não foi encontrada.";
    next(err);
  });

  // Handler final: 400/403/404/500 (HTML com layout MAIN; JSON para API)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    console.error("[server error]", err);

    const status = err.status || err.statusCode || 500;
    const wantsHtml = !!req.accepts("html");

    const defaults = {
      400: "Ocorreu um erro ao processar sua requisição.",
      403: "Você não tem permissão para acessar esta página.",
      404: "A página que você está procurando não foi encontrada.",
      500: "Ocorreu um erro interno no servidor."
    };

    const message = err.publicMessage || err.message || defaults[status] || defaults[500];

    // JSON (para rotas de API)
    if (!wantsHtml) {
      return res.status(status).json({
        message: [message],
        status
      });
    }

    // HTML (seus EJS existentes)
    const view =
      status === 400
        ? "pages/errors/400"
        : status === 403
        ? "pages/errors/403"
        : status === 404
        ? "pages/errors/404"
        : "pages/errors/500";

    // evita vazar stack em produção
    const showStack = AMBIENTE !== "prod";
    const errToView = showStack ? err : {};

    return res.status(status).render(view, {
      status,
      message,
      req,
      err: errToView, // seu 500.ejs usa err.stack
      layout: "layouts/main.ejs" // <-- AQUI: erros sempre com MAIN
    });
  });
}


/* Start server (http + ws) */
function startServer() {
  const port = SERVER_PORT || process.env.PORT || 4000;
  const host = HOST || "0.0.0.0";

  const server = http.createServer(app);
  WebSocketServer(server);

  server.listen(port, host, () => {
    console.log(`Server rodando em http://${host}:${port}/`);
  });

  // shutdown limpo
  const graceful = async (signal) => {
    try {
      console.log(`\n${signal} recebido. Encerrando…`);
      await mongoose.connection.close().catch(() => {});
      server.close(() => {
        console.log("HTTP fechado.");
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5000).unref();
    } catch (e) {
      console.error("Erro no shutdown:", e);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => graceful("SIGINT"));
  process.on("SIGTERM", () => graceful("SIGTERM"));
}


/* Main */
(async () => {
  try {
    if (store?.on) {
      store.on("error", (err) => console.log("Session store error:", err));
    }

    const dbOk = await connectDb();
    
    // rotas SEMPRE
    mountRoutes();

    startServer();
  } catch (err) {
    console.error("❌ Falha geral (erro completo):");
    console.error(err);

    if (err && err.stack) {
      console.error("==== STACK TRACE COMPLETO ====");
      console.error(err.stack);
      console.error("================================");
    }

    console.error("🚫 Não foi possível iniciar o servidor.");
    process.exit(1);
  }
})();
