const Usuario = require("../schemas/core/Usuario");
const UsuarioService = require("./domain/UsuarioService");
const { PERFIS } = require("../config/roles");
const crypto = require("crypto");

async function ensureAdminFromEnv() {
  const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const adminSenha = String(process.env.ADMIN_PASSWORD || "").trim();
  const adminNome = String(process.env.ADMIN_NAME || "Administrador").trim();

  const hasAdmin = await Usuario.exists({ perfil: PERFIS.ADMIN, ativo: true });
  if (hasAdmin) return;

  if (!adminEmail || !adminSenha) {
    const fallbackEmail = "admin@alento.local";
    const fallbackPassword = `Alento@${crypto.randomBytes(6).toString("hex")}1A`;

    await UsuarioService.criar({
      nome: adminNome,
      email: fallbackEmail,
      senha: fallbackPassword,
      perfil: PERFIS.ADMIN,
      ativo: true,
    });

    console.warn("Admin provisÃ³rio criado para primeiro acesso:");
    console.warn(`EMAIL: ${fallbackEmail}`);
    console.warn(`SENHA: ${fallbackPassword}`);
    console.warn("Troque essa senha imediatamente e configure ADMIN_EMAIL/ADMIN_PASSWORD no .env.");
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

  console.log("Admin inicial criado via variaveis de ambiente:", adminEmail);
}

async function ensureSuperAdminFromEnv() {
  const superEmail = String(process.env.SUPERADMIN_EMAIL || "").toLowerCase().trim();
  const superSenha = String(process.env.SUPERADMIN_PASSWORD || "").trim();
  const superNome = String(process.env.SUPERADMIN_NAME || "Super Administrador").trim();

  const hasSuperAdmin = await Usuario.exists({ perfil: PERFIS.SUPERADMIN, ativo: true });
  if (hasSuperAdmin) return;

  if (!superEmail || !superSenha) {
    const fallbackEmail = "superadmin@alento.local";
    const fallbackPassword = `Super@${crypto.randomBytes(6).toString("hex")}1A`;

    await UsuarioService.criar({
      nome: superNome,
      email: fallbackEmail,
      senha: fallbackPassword,
      perfil: PERFIS.SUPERADMIN,
      ativo: true,
      statusAprovacao: "aprovado",
    });

    console.warn("SuperAdmin provisÃƒÂ³rio criado para primeiro acesso:");
    console.warn(`EMAIL: ${fallbackEmail}`);
    console.warn(`SENHA: ${fallbackPassword}`);
    console.warn("Configure SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD no .env.");
    return;
  }

  const existingByEmail = await Usuario.findOne({ email: superEmail }).select("_id");
  if (existingByEmail) {
    await Usuario.findByIdAndUpdate(existingByEmail._id, {
      perfil: PERFIS.SUPERADMIN,
      ativo: true,
      statusAprovacao: "aprovado",
      aprovadoEm: new Date(),
      inativadoEm: null,
      inativadoPor: null,
    });
    console.log("Usuario existente promovido para superadmin:", superEmail);
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

  console.log("SuperAdmin inicial criado via variaveis de ambiente:", superEmail);
}

module.exports = {
  ensureAdminFromEnv,
  ensureSuperAdminFromEnv,
};

