const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const { APPROVAL_ROLES } = require("../../config/approvalRoles");
const { VOLUNTARIO_ACCESS_LEVELS } = require("../../config/volunteerAccess");
const { hashSenha } = require("../security/passwordService");

function isDevLike() {
  const env = String(process.env.AMBIENTE || process.env.NODE_ENV || "")
    .trim()
    .toLowerCase();

  return ["dev", "development", "local", "test", "teste"].includes(env);
}

function normalizeLogin(login) {
  return String(login || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
}

async function resolveLogin(login, currentUserId = null, fallbackLogin = "") {
  const desiredLogin = normalizeLogin(login);
  if (!desiredLogin) return normalizeLogin(fallbackLogin) || undefined;

  const existing = await Usuario.findOne({ login: desiredLogin }).select("_id");
  if (!existing) return desiredLogin;
  if (String(existing._id) === String(currentUserId || "")) return desiredLogin;

  return normalizeLogin(fallbackLogin) || undefined;
}

async function upsertDemoUser({
  email,
  login,
  fallbackLogin,
  nome,
  senha,
  perfil,
  tipoCadastro = "voluntario",
  papelAprovacao = APPROVAL_ROLES.MEMBRO,
  nivelAcessoVoluntario = null,
  dataNascimento = null,
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const passwordHash = await hashSenha(String(senha || ""));
  const existing = await Usuario.findOne({ email: normalizedEmail }).select("_id");
  const resolvedLogin = await resolveLogin(login, existing?._id, fallbackLogin);

  const patch = {
    nome: String(nome || "").trim(),
    email: normalizedEmail,
    senha: passwordHash,
    perfil,
    tipoCadastro,
    nivelAcessoVoluntario: tipoCadastro === "voluntario" ? nivelAcessoVoluntario : null,
    dataNascimento: dataNascimento || null,
    papelAprovacao,
    ativo: true,
    statusAprovacao: "aprovado",
    aprovadoEm: new Date(),
    bloqueadoAte: null,
    tentativasLogin: 0,
    inativadoEm: null,
    inativadoPor: null,
    motivoAprovacao: "",
  };

  if (resolvedLogin) {
    patch.login = resolvedLogin;
  }

  return Usuario.findOneAndUpdate(
    { email: normalizedEmail },
    { $set: patch },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  ).select("_id email login perfil");
}

async function ensureDemoUsers() {
  if (!isDevLike()) {
    return;
  }

  const seededUsers = await Promise.all([
    upsertDemoUser({
      email: process.env.DEMO_ADMIN_EMAIL || "admindemo@alento.local",
      login: process.env.DEMO_ADMIN_LOGIN || "admindemo",
      fallbackLogin: "admindemo",
      nome: process.env.DEMO_ADMIN_NAME || "Administrador Demo",
      senha: process.env.DEMO_ADMIN_PASSWORD || "admin123",
      perfil: PERFIS.ADMIN,
    }),
    upsertDemoUser({
      email: process.env.DEMO_USER_EMAIL || "usuariodemo@alento.local",
      login: process.env.DEMO_USER_LOGIN || "usuariodemo",
      fallbackLogin: "usuariodemo",
      nome: process.env.DEMO_USER_NAME || "Usuario Demo",
      senha: process.env.DEMO_USER_PASSWORD || "usuario123",
      perfil: PERFIS.USUARIO,
      nivelAcessoVoluntario: VOLUNTARIO_ACCESS_LEVELS.SERVICO_SOCIAL,
      dataNascimento: "1992-03-25",
    }),
    upsertDemoUser({
      email: "admin1@alento.local",
      login: "admin1",
      fallbackLogin: "admin1",
      nome: "Admin 1",
      senha: "123",
      perfil: PERFIS.ADMIN,
      papelAprovacao: APPROVAL_ROLES.PRESIDENTE,
    }),
    upsertDemoUser({
      email: "admin2@alento.local",
      login: "admin2",
      fallbackLogin: "admin2",
      nome: "Admin 2",
      senha: "123",
      perfil: PERFIS.ADMIN,
    }),
    upsertDemoUser({
      email: "admin3@alento.local",
      login: "admin3",
      fallbackLogin: "admin3",
      nome: "Admin 3",
      senha: "123",
      perfil: PERFIS.ADMIN,
    }),
    upsertDemoUser({
      email: "helena.demo@alento.local",
      login: "familia1",
      fallbackLogin: "familia1",
      nome: "Helena Demo Souza",
      senha: "123",
      perfil: PERFIS.USUARIO,
      tipoCadastro: "familia",
      dataNascimento: "1987-03-23",
    }),
    upsertDemoUser({
      email: "joana.demo@alento.local",
      login: "familia2",
      fallbackLogin: "familia2",
      nome: "Joana Demo Almeida",
      senha: "123",
      perfil: PERFIS.USUARIO,
      tipoCadastro: "familia",
      dataNascimento: "1990-03-27",
    }),
    upsertDemoUser({
      email: "carlos.demo@alento.local",
      login: "familia3",
      fallbackLogin: "familia3",
      nome: "Carlos Demo Costa",
      senha: "123",
      perfil: PERFIS.USUARIO,
      tipoCadastro: "familia",
      dataNascimento: "1985-03-28",
    }),
  ]);

  console.log(
    `Usuarios demo sincronizados: ${seededUsers
      .map((user) => `${user.email} (${user.login || "-"})`)
      .join(" / ")}`
  );
}

module.exports = {
  ensureDemoUsers,
};
