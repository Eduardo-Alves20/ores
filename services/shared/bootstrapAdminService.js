const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../domain/UsuarioService");
const { PERFIS } = require("../../config/roles");
const { hashSenha } = require("../security/passwordService");
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
    console.warn(
      "Bootstrap de admin ignorado: configure admin.email/admin.password em data/user-config.json ou variaveis de ambiente."
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
  if (!superEmailEnv || !superSenhaEnv) {
    console.warn(
      "Bootstrap de superadmin ignorado: configure superadmin.email/superadmin.password em data/user-config.json ou variaveis de ambiente."
    );
    return;
  }

  const superEmail = superEmailEnv;
  const superSenha = superSenhaEnv;
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
}

module.exports = {
  ensureAdminFromEnv,
  ensureSuperAdminFromEnv,
};
