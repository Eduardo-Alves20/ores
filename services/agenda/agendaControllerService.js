const { registrarAuditoria } = require("../auditService");
const { registrarHistoricoAgenda } = require("../agendaHistoryService");
const { dispatchAgendaNotifications } = require("./domain/agendaNotificationService");

function respondAgendaError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);
  return res.status(Number(error?.status || 500)).json({
    erro: error?.publicMessage || fallbackMessage,
  });
}

async function applyAgendaSideEffects(req, result) {
  if (!result) return;
  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }
  if (result.history) {
    await registrarHistoricoAgenda({
      req,
      ...result.history,
    });
  }
  const notifications = Array.isArray(result.notify)
    ? result.notify
    : result.notify
      ? [result.notify]
      : [];

  for (const notification of notifications) {
    await dispatchAgendaNotifications(notification);
  }
}

async function handleEntityAction({
  action,
  req,
  res,
  entityKey,
  logMessage,
  fallbackMessage,
  statusCode,
}) {
  try {
    const result = await action();
    if (result?.audit) {
      await registrarAuditoria(req, result.audit);
    }
    return res.status(statusCode).json({
      mensagem: result.mensagem,
      [entityKey]: result[entityKey],
    });
  } catch (error) {
    return respondAgendaError(res, logMessage, fallbackMessage, error);
  }
}

async function handleEventAction({
  action,
  req,
  res,
  entityKey,
  logMessage,
  fallbackMessage,
  statusCode,
}) {
  try {
    const result = await action();
    await applyAgendaSideEffects(req, result);
    return res.status(statusCode).json({
      mensagem: result.mensagem,
      [entityKey]: result[entityKey],
    });
  } catch (error) {
    return respondAgendaError(res, logMessage, fallbackMessage, error);
  }
}

module.exports = {
  applyAgendaSideEffects,
  handleEntityAction,
  handleEventAction,
  respondAgendaError,
};
