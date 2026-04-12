const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { getLastCommitDate } = require("../services/getLastCommitDate");
const { logoffAD, loginAD } = require("../services/environment");
const { saveSSOtoken, autoLoginInProd } = require("../services/auth");
const { authenticateBridgeToken } = require("../services/bridgeAuthService");
const { buildSessionUserSnapshot } = require("../services/sessionUserSnapshot");
const { AMBIENTE } = require("../config/env");

async function renderLogin(res, error = null) {
  const lastCommitDate = await getLastCommitDate();

  return res.render("pages/auth/index", {
    layout: "layouts/login.ejs",
    lastCommitDate,
    AMBIENTE,
    error,
  });
}

function buildBridgeSessionContext(payload = {}) {
  return {
    audience: String(payload.aud || "").trim(),
    authVersion: Number.isFinite(Number(payload?.src?.authVersion))
      ? Math.max(0, Math.trunc(Number(payload.src.authVersion)))
      : 0,
    bridgeRole: String(payload.bridgeRole || "").trim().toLowerCase(),
    email: String(payload?.src?.email || "").trim().toLowerCase(),
    issuedAt: Number(payload.iat) * 1000 || Date.now(),
    issuer: String(payload.iss || "").trim(),
    jti: String(payload.jti || "").trim(),
    nivelAcessoVoluntario: String(payload?.src?.nivelAcessoVoluntario || "")
      .trim()
      .toLowerCase(),
    permissions: Array.isArray(payload?.src?.permissions) ? payload.src.permissions : [],
    perfilOrigem: String(payload?.src?.perfil || "").trim().toLowerCase(),
    sourceUserId: String(payload.sub || "").trim(),
    tipoCadastro: String(payload?.src?.tipoCadastro || "").trim().toLowerCase(),
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    if (!req?.session || typeof req.session.regenerate !== "function") {
      return resolve();
    }

    req.session.regenerate((error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

async function loginPage(req, res) {
  try {
    const data = await autoLoginInProd(req, res);

    if (!data) {
      return renderLogin(res);
    }

    res.redirect(req.session.redirectTo || "/");
  } catch (error) {
    return renderLogin(res);
  }
}

async function registerPage(req, res) {
  res.render("register", { error: null });
}

async function register(req, res) {
  try {
    const { name, username, email, password } = req.body;

    const userExists = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (userExists) {
      return res.render("register", {
        error: "Email ou usuario ja cadastrado!",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username,
      email,
      password: hashedPassword,
    });

    req.session.userId = user._id;
    req.session.user = buildSessionUserSnapshot(user);
    delete req.session.bridge;

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.render("register", { error: "Erro ao registrar" });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;

    const localUser = await User.findOne({ username });

    if (localUser?.password) {
      const passwordMatches = await bcrypt.compare(password, localUser.password);

      if (passwordMatches) {
        req.session.startTime = Date.now();
        req.session.logged = true;
        req.session.userId = localUser._id;
        req.session.user = buildSessionUserSnapshot(localUser);
        req.session.type = "usuario";
        delete req.session.bridge;

        return res.redirect("/");
      }

      return renderLogin(res, "Usuario ou senha invalidos.");
    }

    const adData = await loginAD(username, password, req);

    if (adData?.authentication) {
      console.log("Login realizado com sucesso!");

      const user = await User.findOneAndUpdate(
        { username },
        {
          $set: {
            name: adData.name,
            email: adData.email || `${username}@local.hdi`,
            groups: adData.groups,
            cpf: adData.cpf,
            matricula: adData.matricula,
          },
        },
        { new: true, upsert: true }
      );

      req.session.startTime = Date.now();
      req.session.logged = true;
      req.session.userId = user._id;
      req.session.user = buildSessionUserSnapshot(user);
      req.session.type = "usuario";
      req.session.sso_token = adData.token;
      req.session.ssoIssuedAt = Date.now();
      delete req.session.bridge;

      await saveSSOtoken(res, adData.token);

      return res.redirect("/");
    }

    return renderLogin(res, "Usuario ou senha invalidos.");
  } catch (error) {
    console.error(
      "Falha na autenticacao:",
      error.response?.data || error.message
    );

    return renderLogin(res, "Nao foi possivel autenticar nesse ambiente.");
  }
}

async function bridgeLogin(req, res) {
  try {
    const bridgeToken = String(req.body?.bridge_token || "").trim();
    const { payload, user } = await authenticateBridgeToken(bridgeToken);

    await regenerateSession(req);

    req.session.startTime = Date.now();
    req.session.logged = true;
    req.session.userId = user._id;
    req.session.user = buildSessionUserSnapshot(user);
    req.session.type = "usuario";
    req.session.bridge = buildBridgeSessionContext(payload);

    return res.redirect("/");
  } catch (error) {
    console.error("Falha no bridge do HDI:", error?.message || error);
    return renderLogin(res, "Nao foi possivel autenticar o acesso integrado.");
  }
}

async function logout(req, res) {
  try {
    await logoffAD(req, res);

    req.session.destroy();
    res.clearCookie("sso_token");
    res.redirect("/login");
  } catch (error) {
    console.error(error);
  }
}

module.exports = {
  bridgeLogin,
  loginPage,
  registerPage,
  register,
  login,
  logout,
};
