const REDACTED_VALUE = "[REDACTED]";
const TRUNCATED_VALUE = "[TRUNCATED]";
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 600;

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|cpf|password|secret|senha|session|set-cookie|token)/i;

function truncateString(value) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...${TRUNCATED_VALUE}`;
}

function sanitizeForLog(value, key = "", depth = 0) {
  if (SENSITIVE_KEY_PATTERN.test(String(key || ""))) {
    return REDACTED_VALUE;
  }

  if (depth >= MAX_DEPTH) {
    return TRUNCATED_VALUE;
  }

  if (value instanceof Error) {
    return serializeErrorForLog(value, depth + 1);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForLog(item, key, depth + 1));
  }

  if (value && typeof value === "object") {
    const output = {};

    Object.entries(value).forEach(([childKey, childValue]) => {
      output[childKey] = sanitizeForLog(childValue, childKey, depth + 1);
    });

    return output;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  return value;
}

function serializeErrorForLog(error, depth = 0) {
  if (!error) return null;

  return {
    name: truncateString(String(error.name || "Error")),
    message: truncateString(String(error.message || "")),
    code: error.code || "",
    status: Number(error.status || error.statusCode || 0) || undefined,
    stack: typeof error.stack === "string" ? truncateString(error.stack) : undefined,
    cause: error.cause ? sanitizeForLog(error.cause, "cause", depth + 1) : undefined,
  };
}

function logSanitizedError(message, error, context = undefined) {
  if (typeof context === "undefined") {
    console.error(message, serializeErrorForLog(error));
    return;
  }

  console.error(message, {
    error: serializeErrorForLog(error),
    context: sanitizeForLog(context, "context"),
  });
}

module.exports = {
  REDACTED_VALUE,
  logSanitizedError,
  sanitizeForLog,
  serializeErrorForLog,
};
