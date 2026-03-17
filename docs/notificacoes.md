# Modulo de Notificacoes Externas

O backend ja foi preparado para gravar notificacoes internas e tentar enviar por `email` e `whatsapp` quando as credenciais estiverem prontas.

## Variaveis de ambiente

```env
# Email transacional
NOTIFICATIONS_EMAIL_ENABLED=false
NOTIFICATIONS_EMAIL_PROVIDER=resend
NOTIFICATIONS_EMAIL_FROM=Agenda Alento <agenda@notify.institutoalento.ong.br>
NOTIFICATIONS_EMAIL_REPLY_TO=agenda@institutoalento.ong.br
RESEND_API_KEY=

# Whatsapp Cloud API
NOTIFICATIONS_WHATSAPP_ENABLED=false
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v22.0
WHATSAPP_TEMPLATE_LANGUAGE=pt_BR
WHATSAPP_TEMPLATE_AGENDA_STATUS=
```

## Como esta montado

- `services/notificationService.js` cria uma notificacao por canal e destinatario.
- `schemas/core/Notificacao.js` guarda o historico de entrega e eventuais falhas.
- `services/agendaHistoryService.js` registra a linha do tempo do agendamento.

## O que precisa existir quando forem ligar

- Conta/credencial do `Resend` com dominio autenticado.
- Template aprovado no `WhatsApp Cloud API` para `WHATSAPP_TEMPLATE_AGENDA_STATUS`.
- Emails e telefones preenchidos no cadastro dos destinatarios.

## Observacao importante

O envio de WhatsApp ja esta preparado para `template`, nao para mensagem livre. Isso evita retrabalho quando a ONG for homologar o numero oficial.
