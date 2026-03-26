const { LDAP_AUTH_TOKEN, AMBIENTE } = require("../config/env");

let AuthenticationApi;
let UsersApi;
let Configuration;

try {
  ({
    AuthenticationApi,
    UsersApi,
    Configuration,
  } = require("@cge/environment-api"));
} catch (error) {
  console.warn(
    "Pacote opcional @cge/environment-api indisponivel. O ambiente local usara login sem LDAP."
  );
}

let authApi = null;
let usersApi = null;

if (AuthenticationApi && UsersApi && Configuration && LDAP_AUTH_TOKEN) {
  const config = new Configuration({
    basePath: "https://environment.cge.rj.gov.br/api",
    baseOptions: {
      headers: {
        AuthorizationApi: LDAP_AUTH_TOKEN,
      },
    },
  });

  authApi = new AuthenticationApi(config);
  usersApi = new UsersApi(config);
}

function isEnvironmentApiAvailable() {
  return Boolean(authApi && usersApi && LDAP_AUTH_TOKEN);
}

async function filteredUsers() {
  if (!isEnvironmentApiAvailable()) {
    return { status: 200, data: { users: [] }, skipped: true };
  }

  let authorizationapi = LDAP_AUTH_TOKEN;
  let page;
  let limit = 1000;

  const { status, data } = await usersApi.filteredUsersGet(
    authorizationapi,
    page,
    limit
  );

  return { status, data };
}

async function loginAD(username, password, req) {
  if (!authApi || !LDAP_AUTH_TOKEN) {
    throw new Error("Autenticacao LDAP indisponivel neste ambiente.");
  }

  try {
    const origin =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    const response = await authApi.authPost(LDAP_AUTH_TOKEN, {
      username,
      password,
      origin,
    });

    return response.data;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function logoffAD(req, res) {
  if (!authApi) {
    return true;
  }

  try {
    await authApi.logoffGet(req.cookies.sso_token, { withCredentials: true });

    if (AMBIENTE === "HOMOLOG" || AMBIENTE === "PROD") {
      res.clearCookie("sso_token", {
        domain: ".cge.rj.gov.br",
        sameSite: "None",
        secure: true,
      });
    }

    return true;
  } catch (err) {
    console.log(err);
  }
}

module.exports = {
  authApi,
  usersApi,
  filteredUsers,
  logoffAD,
  loginAD,
  isEnvironmentApiAvailable,
};
