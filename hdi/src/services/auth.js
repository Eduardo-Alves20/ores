const { AMBIENTE, LDAP_AUTH, LDAP_AUTH_TOKEN } = require("../config/env");
const User = require("../models/User");
const { authApi } = require("./environment");

async function autoLoginInProd(req, res) {
  const mysession = await verifySession(req, res);

  if (!mysession) return false;

  const user = await User.findOne({ username: mysession.user.username });
  
  if (!user) return false;

  req.session.startTime = Date.now();
  req.session.logged = true;
  req.session.userId = user._id;
  req.session.user = user;
  req.session.type = "usuario";

  // Dados do SSO
  req.session.sso_token = req.cookies?.sso_token;
  req.session.ssoIssuedAt = Date.now();

  return true;
}

async function verifySession(req, res) {
  try {
    if (!authApi) return false;

    const token = req.cookies.sso_token;
    if (!token) return false;

    const origin = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const response = await authApi.verifySessionPost(token, undefined, { origin }, { withCredentials: true });

    if (!response?.data?.authenticated) return false;

    return response.data;
    
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("Erro de autenticação: Sessão inválida ou expirada.");
    } else {
      console.log(error);
    }
    return false;
  }


}

async function saveSSOtoken(res, token) {
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    maxAge: 1000 * 60 * 60, // 1 hora
    domain: ".cge.rj.gov.br",
    sameSite: "None",
  };

  if (AMBIENTE === "LOCAL" || AMBIENTE === "DEV") {
    cookieOptions.secure = false;
    cookieOptions.sameSite = "Lax";
    cookieOptions.domain = "localhost";
  }

  res.cookie("sso_token", token, cookieOptions);
}


module.exports = {
  saveSSOtoken,
  autoLoginInProd,
};
