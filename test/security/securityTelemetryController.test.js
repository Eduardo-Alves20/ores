const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  CSP_REPORT_BODY_TYPES,
  handleCspViolationReport,
  normalizeCspReportPayload,
  selectCspBody,
} = require("../../Controllers/security/SecurityTelemetryController");

function createMockResponse() {
  return {
    statusCode: 200,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

test("normalizeCspReportPayload entende formatos legacy e report-to", () => {
  const legacy = normalizeCspReportPayload({
    "csp-report": {
      "document-uri": "https://ORES.local/painel",
      "blocked-uri": "inline",
      "effective-directive": "script-src",
      "violated-directive": "script-src-elem",
      "line-number": 12,
      "column-number": 5,
    },
  });

  const reportToBody = selectCspBody([
    {
      type: "csp-violation",
      body: {
        "document-uri": "https://ORES.local/painel",
      },
    },
  ]);

  assert.equal(legacy?.effectiveDirective, "script-src");
  assert.equal(legacy?.lineNumber, 12);
  assert.equal(reportToBody?.["document-uri"], "https://ORES.local/painel");
  assert.ok(CSP_REPORT_BODY_TYPES.includes("application/csp-report"));
});

test("handleCspViolationReport registra evento e retorna 204", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ORES-csp-report-"));
  const logPath = path.join(tempDir, "security-events.log");
  const previousPath = process.env.SECURITY_EVENT_LOG_PATH;
  process.env.SECURITY_EVENT_LOG_PATH = logPath;

  const req = {
    method: "POST",
    originalUrl: "/api/security/csp-report",
    body: {
      "csp-report": {
        "document-uri": "https://ORES.local/painel",
        "blocked-uri": "inline",
        "effective-directive": "script-src",
      },
    },
    headers: { "x-forwarded-for": "10.0.0.1" },
    get(name) {
      if (String(name || "").toLowerCase() === "user-agent") {
        return "node-test";
      }
      return "";
    },
    session: {
      user: {
        id: "507f1f77bcf86cd799439011",
      },
    },
  };

  const res = createMockResponse();
  handleCspViolationReport(req, res);

  const writtenLine = fs.readFileSync(logPath, "utf8").trim();
  const parsed = JSON.parse(writtenLine);

  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(parsed.type, "CSP_VIOLATION");
  assert.equal(parsed.actorId, "507f1f77bcf86cd799439011");
  assert.equal(parsed.payload.effectiveDirective, "script-src");

  if (typeof previousPath === "undefined") {
    delete process.env.SECURITY_EVENT_LOG_PATH;
  } else {
    process.env.SECURITY_EVENT_LOG_PATH = previousPath;
  }
});
