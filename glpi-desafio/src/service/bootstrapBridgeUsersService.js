import { pegarDb } from "../compartilhado/db/mongo.js";
import { gerarHashSenha } from "../compartilhado/seguranca/senha.js";

function isProdLike() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

async function upsertBridgeUser({
  nome,
  usuario,
  email,
  perfil,
  senha,
}) {
  const now = new Date();
  const senhaHash = await gerarHashSenha(senha);

  await pegarDb().collection("usuarios").updateOne(
    { usuario },
    {
      $set: {
        nome,
        usuario,
        email,
        perfil,
        status: "ativo",
        senhaHash,
        updatedAt: now,
        atualizadoEm: now,
      },
      $setOnInsert: {
        criadoEm: now,
        customFields: {},
      },
    },
    { upsert: true },
  );
}

export async function ensureBridgeUsers() {
  if (isProdLike()) {
    return;
  }

  await upsertBridgeUser({
    nome: process.env.GLPI_BRIDGE_ADMIN_NAME || "Administrador Ponte",
    usuario: process.env.HELPDESK_ADMIN_LOGIN || process.env.GLPI_BRIDGE_ADMIN_LOGIN || "admin",
    email: process.env.GLPI_BRIDGE_ADMIN_EMAIL || "admin@local.glpi",
    perfil: "admin",
    senha: process.env.GLPI_BRIDGE_ADMIN_PASSWORD || "admin123",
  });

  await upsertBridgeUser({
    nome: process.env.GLPI_BRIDGE_USER_NAME || "Usuario Ponte",
    usuario: process.env.HELPDESK_USER_LOGIN || process.env.GLPI_BRIDGE_USER_LOGIN || "usuario",
    email: process.env.GLPI_BRIDGE_USER_EMAIL || "usuario@local.glpi",
    perfil: "usuario",
    senha: process.env.GLPI_BRIDGE_USER_PASSWORD || "123",
  });

  console.log("[bootstrap] usuarios de ponte do GLPI sincronizados");
}
