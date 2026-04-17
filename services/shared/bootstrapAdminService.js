const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../domain/UsuarioService");
const { PERFIS } = require("../../config/roles");
const { hashSenha } = require("../security/passwordService");
const crypto = require("crypto");
const { loadUserConfig } = require("./userConfigService");

async function ensureAdminFromEnv() {
  const userConfig = loadUserConfig();
  const adminConfig = userConfig?.admin || {};
  const adminEmail = String(adminConfig.email || process.env.ADMIN_EMAIL || "")
    .toLowerCase()
    .trim();
  const adminSenha = String(adminConfig.password || process.env.ADMIN_PASSWORD || "").trim();
  const adminNome = String(adminConfig.name || process.env.ADMIN_NAME || "Administrador").trim();

  const hasAdmin = await Usuario.exists({ perfil: PERFIS.ADMIN, ativo: true });
  if (hasAdmin) return;

  if (!adminEmail || !adminSenha) {
    const fallbackEmail = "admin@ORES.local";
    const fallbackPassword = `ORES@${crypto.randomBytes(6).toString("hex")}1A`;

    await UsuarioService.criar({
      nome: adminNome,
      email: fallbackEmail,
      senha: fallbackPassword,
      perfil: PERFIS.ADMIN,
      ativo: true,
    });

    console.warn("Admin provisario criado para primeiro acesso:");
    console.warn(`EMAIL: ${fallbackEmail}`);
    console.warn(`SENHA: ${fallbackPassword}`);
    console.warn(
      "Troque essa senha imediatamente e configure admin.email/admin.password em data/user-config.json."
    );
    return;
  }

  const existingByEmail = await Usuario.findOne({ email: adminEmail }).select("_id");
  if (existingByEmail) {
    await Usuario.findByIdAndUpdate(existingByEmail._id, {
      perfil: PERFIS.ADMIN,
      ativo: true,
      statusAprovacao: "aprovado",
      aprovadoEm: new Date(),
      inativadoEm: null,
      inativadoPor: null,
    });
    console.log("Usuario existente promovido para admin:", adminEmail);
    return;
  }

  await UsuarioService.criar({
    nome: adminNome,
    email: adminEmail,
    senha: adminSenha,
    perfil: PERFIS.ADMIN,
    ativo: true,
  });

  console.log("Admin inicial criado via configuracao de usuarios:", adminEmail);
}

async function ensureSuperAdminFromEnv() {
  const userConfig = loadUserConfig();
  const superConfig = userConfig?.superadmin || {};
  const superEmailEnv = String(superConfig.email || process.env.SUPERADMIN_EMAIL || "")
    .toLowerCase()
    .trim();
  const superSenhaEnv = String(superConfig.password || process.env.SUPERADMIN_PASSWORD || "").trim();
  const superNome = String(
    superConfig.name || process.env.SUPERADMIN_NAME || "Super Administrador"
  ).trim();
  const superFallbackEmail = "superadmin@ORES.local";
  const superFallbackSenha = String(
    superConfig.bootstrapPassword ||
      process.env.SUPERADMIN_BOOTSTRAP_PASSWORD ||
      "SuperAdmin123!"
  ).trim();

  const useEnvCredentials = !!(superEmailEnv && superSenhaEnv);
  const superEmail = useEnvCredentials ? superEmailEnv : superFallbackEmail;
  const superSenha = useEnvCredentials ? superSenhaEnv : superFallbackSenha;
  const shouldSyncPassword =
    String(
      typeof superConfig.syncPassword === "boolean"
        ? superConfig.syncPassword
        : process.env.SUPERADMIN_SYNC_PASSWORD || "true"
    )
      .toLowerCase()
      .trim() === "true";

  const existingByEmail = await Usuario.findOne({ email: superEmail }).select("_id");
  if (existingByEmail) {
    const patch = {
      perfil: PERFIS.SUPERADMIN,
      ativo: true,
      statusAprovacao: "aprovado",
      aprovadoEm: new Date(),
      inativadoEm: null,
      inativadoPor: null,
      nome: superNome,
      bloqueadoAte: null,
      tentativasLogin: 0,
    };

    if (shouldSyncPassword) {
      patch.senha = await hashSenha(superSenha);
    }

    await Usuario.findByIdAndUpdate(existingByEmail._id, patch);
    console.log("SuperAdmin bootstrap sincronizado:", superEmail);
    return;
  }

  await UsuarioService.criar({
    nome: superNome,
    email: superEmail,
    senha: superSenha,
    perfil: PERFIS.SUPERADMIN,
    ativo: true,
    statusAprovacao: "aprovado",
  });

  console.log("SuperAdmin bootstrap criado:", superEmail);
  if (!useEnvCredentials) {
    console.warn("SuperAdmin bootstrap padrao ativo:");
    console.warn(`EMAIL: ${superEmail}`);
    console.warn(`SENHA: ${superSenha}`);
    console.warn(
      "Defina superadmin.email/superadmin.password em data/user-config.json para sobrescrever."
    );
  }
}

module.exports = {
  ensureAdminFromEnv,
  ensureSuperAdminFromEnv,
};
