import pino from "pino";

/**
 * Structured logger for Sentry Safety.
 *
 * Conventions:
 * - Never log raw document content. Use scanId + length + verdict only.
 * - Redact paths cover common adversarial surfaces (auth headers, base64
 *   document bodies, free-form content fields).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "sentry-safety" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-api-key']",
      "*.content",
      "*.file_base64",
    ],
    censor: "[REDACTED]",
  },
});
