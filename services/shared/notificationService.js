const Usuario = require("../../schemas/core/Usuario");
const { Notificacao } = require("../../schemas/core/Notificacao");

const EMAIL_PROVIDER_RESEND = "resend";

function parseBooleanFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

function uniqueRecipients(recipients) {
  const seen = new Set();
  const result = [];

  (Array.isArray(recipients) ? recipients : []).forEach((item) => {
    if (!item || typeof item !== "object") return;

    const key = [
      String(item.usuarioId || ""),
      normalizeEmail(item.email),
      normalizePhone(item.telefone),
      String(item.nome || "").trim().toLowerCase(),
    ].join("|");

    if (!key.replace(/\|/g, "")) return;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}

function getNotificationRuntimeConfig() {
  return {
    email: {
      enabled: parseBooleanFlag(process.env.NOTIFICATIONS_EMAIL_ENABLED),
      provider: String(process.env.NOTIFICATIONS_EMAIL_PROVIDER || EMAIL_PROVIDER_RESEND).trim().toLowerCase(),
      resendApiKey: String(process.env.RESEND_API_KEY || "").trim(),
      from: String(process.env.NOTIFICATIONS_EMAIL_FROM || process.env.RESEND_FROM || "").trim(),
      replyTo: String(process.env.NOTIFICATIONS_EMAIL_REPLY_TO || "").trim(),
    },
    whatsapp: {
      enabled: parseBooleanFlag(process.env.NOTIFICATIONS_WHATSAPP_ENABLED),
      accessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim(),
      phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
      templateName: String(process.env.WHATSAPP_TEMPLATE_AGENDA_STATUS || "").trim(),
      templateLanguage: String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR").trim(),
      apiVersion: String(process.env.WHATSAPP_API_VERSION || "v22.0").trim(),
    },
  };
}

function buildEmailHtml({ titulo, mensagem, destinatarioNome = "", meta = {} }) {
  const items = [
    meta?.statusPresenca ? `<li><strong>Status:</strong> ${meta.statusPresenca}</li>` : "",
    meta?.tituloEvento ? `<li><strong>Agendamento:</strong> ${meta.tituloEvento}</li>` : "",
    meta?.inicioLabel ? `<li><strong>Horario:</strong> ${meta.inicioLabel}</li>` : "",
    meta?.responsavelNome ? `<li><strong>Profissional:</strong> ${meta.responsavelNome}</li>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">${titulo}</h2>
      <p>Ola${destinatarioNome ? `, ${destinatarioNome}` : ""}.</p>
      <p>${mensagem}</p>
      ${items ? `<ul>${items}</ul>` : ""}
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        Esta mensagem foi gerada automaticamente pelo sistema Alento.
      </p>
    </div>
  `;
}

function buildWhatsAppBodyParameters(destinatarioNome, meta = {}) {
  return [
    { type: "text", text: String(destinatarioNome || "Responsavel") },
    { type: "text", text: String(meta?.statusPresenca || "Atualizado") },
    { type: "text", text: String(meta?.tituloEvento || "Agendamento") },
    { type: "text", text: String(meta?.inicioLabel || "-") },
    { type: "text", text: String(meta?.responsavelNome || "-") },
  ];
}

async function sendEmailWithResend(config, delivery) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [delivery.destinatarioEmail],
      reply_to: config.replyTo || undefined,
      subject: delivery.titulo,
      html: buildEmailHtml({
        titulo: delivery.titulo,
        mensagem: delivery.mensagem,
        destinatarioNome: delivery.destinatarioNome,
        meta: delivery.payload?.meta || {},
      }),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha no envio de email (${response.status}): ${body.slice(0, 400)}`);
  }
}

async function sendWhatsAppWithMeta(config, delivery) {
  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: delivery.destinatarioTelefone,
        type: "template",
        template: {
          name: config.templateName,
          language: {
            code: config.templateLanguage,
          },
          components: [
            {
              type: "body",
              parameters: buildWhatsAppBodyParameters(
                delivery.destinatarioNome,
                delivery.payload?.meta || {}
              ),
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha no envio de whatsapp (${response.status}): ${body.slice(0, 400)}`);
  }
}

async function deliverNotification(notificacao, config) {
  if (notificacao.canal === "sistema") {
    notificacao.status = "enviado";
    notificacao.enviadoEm = new Date();
    notificacao.tentativas = 1;
    await notificacao.save();
    return notificacao;
  }

  if (notificacao.canal === "email") {
    if (!config.email.enabled) {
      notificacao.status = "desabilitado";
      notificacao.erroMensagem = "Canal de email desabilitado nas variaveis de ambiente.";
      await notificacao.save();
      return notificacao;
    }

    if (!notificacao.destinatarioEmail || !config.email.resendApiKey || !config.email.from) {
      notificacao.status = "desabilitado";
      notificacao.erroMensagem = "Email sem destinatario ou configuracao incompleta.";
      await notificacao.save();
      return notificacao;
    }

    await sendEmailWithResend(config.email, notificacao);
    notificacao.status = "enviado";
    notificacao.enviadoEm = new Date();
    notificacao.tentativas += 1;
    await notificacao.save();
    return notificacao;
  }

  if (notificacao.canal === "whatsapp") {
    if (!config.whatsapp.enabled) {
      notificacao.status = "desabilitado";
      notificacao.erroMensagem = "Canal de whatsapp desabilitado nas variaveis de ambiente.";
      await notificacao.save();
      return notificacao;
    }

    if (
      !notificacao.destinatarioTelefone ||
      !config.whatsapp.accessToken ||
      !config.whatsapp.phoneNumberId ||
      !config.whatsapp.templateName
    ) {
      notificacao.status = "desabilitado";
      notificacao.erroMensagem = "Whatsapp sem destino ou configuracao/template incompletos.";
      await notificacao.save();
      return notificacao;
    }

    await sendWhatsAppWithMeta(config.whatsapp, notificacao);
    notificacao.status = "enviado";
    notificacao.enviadoEm = new Date();
    notificacao.tentativas += 1;
    await notificacao.save();
    return notificacao;
  }

  notificacao.status = "desabilitado";
  notificacao.erroMensagem = "Canal nao reconhecido.";
  await notificacao.save();
  return notificacao;
}

async function resolveAdminRecipients() {
  const admins = await Usuario.find({
    ativo: true,
    perfil: { $in: ["admin", "superadmin"] },
  })
    .select("_id nome email telefone")
    .lean();

  return admins.map((item) => ({
    usuarioId: item._id,
    nome: item.nome,
    email: item.email,
    telefone: item.telefone,
  }));
}

async function notify({
  categoria,
  evento,
  titulo,
  mensagem,
  recipients = [],
  referenciaTipo = "",
  referenciaId = "",
  payload = {},
}) {
  const runtime = getNotificationRuntimeConfig();
  const deliveries = [];

  for (const recipient of uniqueRecipients(recipients)) {
    const channels = Array.isArray(recipient.channels) && recipient.channels.length
      ? recipient.channels
      : ["sistema"];

    for (const canal of channels) {
      const notificacao = await Notificacao.create({
        categoria,
        evento,
        canal,
        usuarioId: recipient.usuarioId || null,
        destinatarioNome: String(recipient.nome || "").trim(),
        destinatarioEmail: normalizeEmail(recipient.email),
        destinatarioTelefone: normalizePhone(recipient.telefone),
        titulo,
        mensagem,
        referenciaTipo,
        referenciaId: referenciaId ? String(referenciaId) : "",
        payload,
      });

      try {
        await deliverNotification(notificacao, runtime);
      } catch (error) {
        notificacao.status = "falha";
        notificacao.tentativas += 1;
        notificacao.erroMensagem = String(error?.message || "Falha inesperada no envio.").slice(0, 1000);
        await notificacao.save();
      }

      deliveries.push(notificacao);
    }
  }

  return deliveries;
}

module.exports = {
  getNotificationRuntimeConfig,
  notify,
  resolveAdminRecipients,
};
