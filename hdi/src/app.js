require("dotenv").config();
const express = require("express");
const expressLayout = require("express-ejs-layouts");
const cookieParser = require("cookie-parser");
const flash = require("express-flash");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const boardRoutes = require("./routes/boardRoutes");
const cardRoutes = require("./routes/cardRoutes");
const authRoutes = require("./routes/authRoutes");
const { loadOrCreateCookieParserKey } = require("./config/config");
const { sessionParser, SERVER_PORT, HOST, DB_URI } = require("./config/env");
const { csrfProtection, attachCsrfLocals } = require("./middlewares/csrfProtection");
const {
  applyDynamicNoStoreHeaders,
  applySecurityHeaders,
} = require("./middlewares/requestSecurity");
const { syncUsersFromLDAP } = require("./services/pooling");
const { ensureLocalAdmin, ensureLocalUser } = require("./services/bootstrapLocalAdmin");
const isAuthenticated = require("./middlewares/authMiddleware");
const sidebarDataMiddleware = require("./middlewares/sidebarDataMiddleware");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const cookieParserKey = loadOrCreateCookieParserKey();

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    dotfiles: "deny",
    fallthrough: false,
    index: false,
    maxAge: 0,
    redirect: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true, limit: "1mb", parameterLimit: 200 }));
app.use(cookieParser(cookieParserKey));
app.use(express.json({ limit: "1mb" }));
app.use(expressLayout);
app.use(applySecurityHeaders);

io.on("connection", (socket) => {
  console.log("Um usuario conectou via Socket:", socket.id);

  socket.on("joinBoard", (boardId) => {
    socket.join(boardId);
    console.log(`Socket ${socket.id} entrou na sala do board ${boardId}`);
  });

  socket.on("disconnect", () => {
    console.log("Usuario se desconectou");
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(
  morgan(function (tokens, req, res) {
    const date = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    const usuario = req?.session?.user?.username || "Desconhecido";
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

app.use(sessionParser);
app.use(flash());
app.use(applyDynamicNoStoreHeaders);
app.use((req, res, next) => {
  if (req.path === "/bridge/sso") {
    attachCsrfLocals(req, res);
    return next();
  }

  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use(sidebarDataMiddleware);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", authRoutes);
app.use("/", isAuthenticated, boardRoutes);
app.use("/", isAuthenticated, cardRoutes);

async function start() {
  try {
    await mongoose.connect(DB_URI, {
      connectTimeoutMS: 600000,
    });

    console.log("MongoDB Conectado!");

    await syncUsersFromLDAP();
    await ensureLocalAdmin();
    await ensureLocalUser();

    server.listen(SERVER_PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${SERVER_PORT}/`);
    });
  } catch (error) {
    console.error("Erro ao iniciar aplicacao:", error);
    process.exit(1);
  }
}

start();
