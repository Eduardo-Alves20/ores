require("dotenv").config({ override: true });
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const flash = require("express-flash");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const http = require("http");
const { attachCurrentUser } = require("./middlewares/authSession");
const { csrfProtection } = require("./middlewares/csrfProtection");
const { applySecurityHeaders } = require("./middlewares/securityHeaders");
const { applyDynamicNoStoreHeaders } = require("./middlewares/requestSecurity");
const { createErrorHandler, createNotFoundHandler } = require("./middlewares/errorResponder");
const { buildSeo } = require("./services/seoService");
const { serializeForInlineScript } = require("./services/viewSerializationService");
const Usuario = require("./schemas/core/Usuario");
const { PERFIS } = require("./config/roles");
const { PERMISSIONS } = require("./config/permissions");
const { hasAnyPermission } = require("./services/accessControlService");
const { ensureAdminFromEnv, ensureSuperAdminFromEnv } = require("./services/bootstrapAdminService");
const { ensureDemoUsers } = require("./services/bootstrapDemoUsersService");
const { ensureDemoClinicData } = require("./services/bootstrapDemoClinicDataService");

const app = express();
const ASSET_VERSION = process.env.ASSET_VERSION || new Date().getTime().toString();
const JSON_BODY_LIMIT = String(process.env.MAX_JSON_BODY_SIZE || "1mb").trim();
const FORM_BODY_LIMIT = String(process.env.MAX_FORM_BODY_SIZE || "250kb").trim();

const {
  PORT,
  HOST,
  AMBIENTE,
  sessionParser,
} = require("./config/env");

const { loadOrCreateCookieParserKey } = require("./config/config");
const cookieParserKey = loadOrCreateCookieParserKey();

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = process.env.DB_PORT || "27017";
const MONGO_FALLBACK = `mongodb://${DB_HOST}:${DB_PORT}/ALENTO`;
const RAW_MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || MONGO_FALLBACK;

function normalizeMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    const isLocal =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    if (isLocal && !parsed.searchParams.has("directConnection")) {
      parsed.searchParams.set("directConnection", "true");
      return parsed.toString();
    }
  } catch (_) {
    return uri;
  }
  return uri;
}

const MONGO_URI = normalizeMongoUri(RAW_MONGO_URI);

mongoose.set("bufferCommands", false);

async function connectDb() {
  if (!MONGO_URI) {
    console.warn("MONGO_URI nao definido. Subindo sem banco...");
    return false;
  }
  await mongoose.connect(MONGO_URI, { maxPoolSize: 10 });
  await mongoose.connection.asPromise();
  console.log("Mongo conectado");
  return true;
}

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("trust proxy", 1);
app.set("layout", "partials/login.ejs");
app.locals.serializeForInlineScript = serializeForInlineScript;
app.locals.cspNonce = "";
app.locals.renderCspNonceAttr = () => "";

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: FORM_BODY_LIMIT, parameterLimit: 100 }));
app.use(cookieParser(cookieParserKey));
app.use(compression());
app.use(applySecurityHeaders);
app.use(sessionParser);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    redirect: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);
app.use("/assets", express.static(path.join(__dirname, "public", "assets")));
app.use("/css", express.static(path.join(__dirname, "public", "css")));
app.use("/js", express.static(path.join(__dirname, "public", "js")));
app.use("/static", express.static(path.join(__dirname, "public")));
app.use(applyDynamicNoStoreHeaders);
app.use(csrfProtection);
app.use(flash());
app.use(attachCurrentUser);

app.use(async (req, res, next) => {
  try {
    res.locals.ambiente = AMBIENTE;
    res.locals.assetVersion = ASSET_VERSION;
    res.locals.lastCommitDate = `Ultima atualizacao em: ${new Date().toLocaleString("pt-BR")}`;
    res.locals.alert = null;
    res.locals.serializeForInlineScript = serializeForInlineScript;
    res.locals.moduleLinks = {
      helpDeskUrl: String(process.env.HELPDESK_URL || "").trim(),
      hdiUrl: String(process.env.HDI_URL || "").trim(),
    };

    const sess = req.session || {};
    const sessUser = sess.user || null;

    res.locals.user = sessUser;
    res.locals.username = sessUser?.nome || sessUser?.email || null;
    res.locals.pendingApprovalCount = 0;

    const canApprove =
      String(sessUser?.perfil || "").toLowerCase() === PERFIS.SUPERADMIN ||
      hasAnyPermission(sessUser?.permissions || [], [PERMISSIONS.ACESSOS_APPROVE]);

    if (canApprove) {
      res.locals.pendingApprovalCount = await Usuario.countDocuments({
        perfil: PERFIS.USUARIO,
        statusAprovacao: "pendente",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  res.locals.buildSeo = (overrides = {}) => buildSeo(req, overrides);
  res.set("X-Robots-Tag", buildSeo(req).robots);
  next();
});

app.use(
  morgan((tokens, req, res) => {
    const date = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const usuario =
      req?.session?.user?.nome ||
      req?.session?.user?.email ||
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
      `Tempo: ${tokens["response-time"](req, res)} ms`,
    ].join(" ");
  })
);

function mountRoutes() {
  const routes = require("./routes");
  app.use("/", routes);
  app.use(createNotFoundHandler());
  app.use(createErrorHandler({ baseDir: __dirname, ambiente: AMBIENTE }));
}

function startServer() {
  const port = PORT || process.env.PORT || 4000;
  const host = HOST || "0.0.0.0";

  const server = http.createServer(app);

  server.listen(port, host, () => {
    console.log(`Server rodando em http://${host}:${port}/`);
  });

  const graceful = async (signal) => {
    try {
      console.log(`\n${signal} recebido. Encerrando...`);
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

(async () => {
  try {
    await connectDb();
    await ensureSuperAdminFromEnv();
    await ensureAdminFromEnv();
    await ensureDemoUsers();
    await ensureDemoClinicData();

    mountRoutes();
    startServer();
  } catch (err) {
    console.error("Falha geral (erro completo):");
    console.error(err);

    if (err && err.stack) {
      console.error("==== STACK TRACE COMPLETO ====");
      console.error(err.stack);
      console.error("================================");
    }

    console.error("Nao foi possivel iniciar o servidor.");
    process.exit(1);
  }
})();
