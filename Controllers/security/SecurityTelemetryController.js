const express = require("express");
const { logSecurityEvent } = require("../../services/security/securityEventService");

const CSP_REPORT_BODY_TYPES = [
  "application/csp-report",
  "application/json",
  "application/reports+json",
];

const cspReportJsonParser = express.json({
  limit: "64kb",
  type: CSP_REPORT_BODY_TYPES,
});

function normalizeString(value, maxLength = 600) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
}

function selectCspBody(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const reportEntry = payload.find((entry) =>
      String(entry?.type || "").trim().toLowerCase().includes("csp")
    );

    if (reportEntry?.body && typeof reportEntry.body === "object") {
      return reportEntry.body;
    }

    return null;
  }

  if (payload["csp-report"] && typeof payload["csp-report"] === "object") {
    return payload["csp-report"];
  }

  if (payload.body && typeof payload.body === "object") {
    return payload.body;
  }

  if (typeof payload === "object") {
    return payload;
  }

  return null;
}

function normalizeCspReportPayload(payload) {
  const body = selectCspBody(payload);
  if (!body) return null;

  const normalized = {
    blockedUri: normalizeString(body["blocked-uri"] || body.blockedUri),
    documentUri: normalizeString(body["document-uri"] || body.documentUri),
    effectiveDirective: normalizeString(
      body["effective-directive"] || body.effectiveDirective
    ),
    violatedDirective: normalizeString(
      body["violated-directive"] || body.violatedDirective
    ),
    disposition: normalizeString(body.disposition),
    sourceFile: normalizeString(body["source-file"] || body.sourceFile),
    lineNumber: Number(body["line-number"] || body.lineNumber || 0) || 0,
    columnNumber: Number(body["column-number"] || body.columnNumber || 0) || 0,
    statusCode: Number(body["status-code"] || body.statusCode || 0) || 0,
    scriptSample: normalizeString(body["script-sample"] || body.scriptSample, 300),
  };

  const hasRelevantValue = Object.values(normalized).some((value) => {
    if (typeof value === "number") return value > 0;
    return String(value || "").trim().length > 0;
  });

  if (!hasRelevantValue) return null;
  return normalized;
}

function handleCspViolationReport(req, res) {
  const normalizedReport = normalizeCspReportPayload(req.body);

  if (!normalizedReport) {
    return res.status(204).end();
  }

  logSecurityEvent({
    type: "CSP_VIOLATION",
    severity: "warning",
    actorId: req?.session?.user?.id || null,
    ip:
      req?.headers?.["x-forwarded-for"] ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      "",
    method: req?.method || "",
    route: req?.originalUrl || req?.url || "",
    userAgent: req?.get?.("user-agent") || "",
    payload: normalizedReport,
  });

  return res.status(204).end();
}

module.exports = {
  CSP_REPORT_BODY_TYPES,
  cspReportJsonParser,
  handleCspViolationReport,
  normalizeCspReportPayload,
  selectCspBody,
};
