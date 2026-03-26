const rateLimit = require("express-rate-limit");
const requestIp = require("request-ip");

const isDevLike = ["dev", "development", "local", "test", "teste"].includes(
  String(process.env.AMBIENTE || process.env.NODE_ENV || "").trim().toLowerCase()
);

function buildIpLimiter({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    message,
    keyGenerator: (req) => requestIp.getClientIp(req),
  });
}

const passwordMutationLimiter = buildIpLimiter({
  windowMs: 15 * 60 * 1000,
  max: isDevLike ? 80 : 12,
  message:
    "Muitas tentativas de alterar senha. Aguarde alguns minutos antes de tentar novamente.",
});

const portalMutationLimiter = buildIpLimiter({
  windowMs: 10 * 60 * 1000,
  max: isDevLike ? 120 : 40,
  message:
    "Muitas requisicoes sensiveis foram realizadas. Aguarde alguns minutos e tente novamente.",
});

const moduleBridgeLimiter = buildIpLimiter({
  windowMs: 10 * 60 * 1000,
  max: isDevLike ? 100 : 20,
  message:
    "Muitas tentativas de acesso ao modulo externo. Aguarde alguns minutos e tente novamente.",
});

module.exports = {
  buildIpLimiter,
  moduleBridgeLimiter,
  passwordMutationLimiter,
  portalMutationLimiter,
};
