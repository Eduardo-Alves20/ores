const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  logSecurityEvent,
  resolveSecurityEventLogPath,
} = require("../../services/security/securityEventService");

test("logSecurityEvent encadeia hash e sanitiza payload sensivel", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ORES-security-event-"));
  const logPath = path.join(tempDir, "events.log");

  const first = logSecurityEvent(
    {
      type: "auth.login_failed",
      severity: "warning",
      ip: "127.0.0.1",
      payload: { email: "teste@ORES.local", token: "segredo" },
    },
    { filePath: logPath }
  );

  const second = logSecurityEvent(
    {
      type: "auth.login_failed",
      severity: "warning",
      ip: "127.0.0.1",
      payload: { email: "teste@ORES.local", token: "segredo-2" },
    },
    { filePath: logPath }
  );

  const lines = fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  assert.equal(lines.length, 2);
  assert.equal(first.payload.token, "[REDACTED]");
  assert.equal(second.payload.token, "[REDACTED]");
  assert.equal(typeof first.hash, "string");
  assert.equal(first.hash.length, 64);
  assert.equal(second.prevHash, first.hash);
  assert.equal(resolveSecurityEventLogPath(logPath), logPath);
});
