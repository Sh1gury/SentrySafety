const VERDICT_SCHEMA = {
  type: "string",
  enum: ["allow", "warn", "block"],
};

const PII_ENTITY_SCHEMA = {
  type: "string",
  enum: [
    "PERSON",
    "ORGANIZATION",
    "LOCATION",
    "EMAIL",
    "PHONE",
    "CREDIT_CARD",
    "IBAN",
    "IP",
  ],
};

const SANITIZE_REQUEST_SCHEMA = {
  type: "object",
  properties: {
    filename: { type: "string" },
    content: { type: "string", description: "Plain text. Mutually exclusive with file_base64." },
    file_base64: { type: "string", description: "Base64-encoded file. Mutually exclusive with content." },
    metadata: { type: "object", additionalProperties: { type: "string" } },
    config: {
      type: "object",
      properties: {
        privacy: {
          type: "object",
          properties: {
            mask_pii: { type: "boolean" },
            entities_to_mask: { type: "array", items: PII_ENTITY_SCHEMA },
          },
        },
        security: {
          type: "object",
          properties: {
            block_injections: { type: "boolean" },
            max_decompression_ratio: { type: "number" },
            strip_macros: { type: "boolean" },
          },
        },
        integrity: {
          type: "object",
          properties: {
            check_autophagy: { type: "boolean" },
          },
        },
      },
    },
  },
};

const THREATS_BLOCKED_SCHEMA = {
  type: "object",
  required: ["zip_bombs", "mime_mismatch", "macros_stripped", "prompt_injections"],
  properties: {
    zip_bombs: { type: "integer" },
    mime_mismatch: { type: "integer" },
    macros_stripped: { type: "integer" },
    prompt_injections: { type: "integer" },
  },
};

const AGENT_VERDICT_SCHEMA = {
  type: "object",
  required: ["verdict", "score"],
  properties: {
    verdict: VERDICT_SCHEMA,
    score: { type: "number" },
  },
};

const SANITIZE_SUCCESS_SCHEMA = {
  type: "object",
  required: ["status", "scanId", "verdict", "clean_text", "metadata", "latencyMs"],
  properties: {
    status: { type: "string", enum: ["success"] },
    scanId: { type: "string" },
    verdict: VERDICT_SCHEMA,
    clean_text: { type: "string" },
    tokenMap: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Returned only to authenticated callers.",
    },
    metadata: {
      type: "object",
      required: [
        "pii_masked_count",
        "threats_blocked",
        "synthetic_spam_removed",
        "layer1",
        "layer2",
        "layer3",
      ],
      properties: {
        pii_masked_count: { type: "integer" },
        threats_blocked: THREATS_BLOCKED_SCHEMA,
        synthetic_spam_removed: { type: "boolean" },
        layer1: {
          type: "object",
          required: ["verdict", "removed_paragraphs"],
          properties: {
            verdict: VERDICT_SCHEMA,
            removed_paragraphs: { type: "integer" },
          },
        },
        layer2: {
          type: "object",
          required: ["verdict", "score", "demoMode", "agents"],
          properties: {
            verdict: VERDICT_SCHEMA,
            score: { type: "number" },
            demoMode: { type: "boolean" },
            agents: {
              type: "object",
              required: ["semantic", "logic"],
              properties: {
                semantic: AGENT_VERDICT_SCHEMA,
                logic: AGENT_VERDICT_SCHEMA,
              },
            },
          },
        },
        layer3: {
          type: "object",
          required: ["enabled"],
          properties: {
            enabled: { type: "boolean" },
            synthetic_paragraphs_removed: { type: "integer" },
            confidence: { type: "number" },
          },
        },
      },
    },
    latencyMs: { type: "integer" },
  },
};

const SANITIZE_ERROR_SCHEMA = {
  type: "object",
  required: ["status", "error", "message"],
  properties: {
    status: { type: "string", enum: ["error"] },
    error: {
      type: "string",
      enum: [
        "invalid_payload",
        "encrypted_archive",
        "payload_too_large",
        "unsupported_media_type",
        "rate_limited",
        "engine_error",
        "model_unavailable",
      ],
    },
    message: { type: "string" },
  },
};

const SANITIZE_RESPONSE_SCHEMA = {
  oneOf: [SANITIZE_SUCCESS_SCHEMA, SANITIZE_ERROR_SCHEMA],
};

const OPENAPI_DOC = {
  openapi: "3.1.0",
  info: {
    title: "Sentry Safety API",
    version: "1.0.0",
    description: "Pre-RAG document firewall. Scans, sanitises, and anonymises documents before they reach a downstream RAG knowledge base.",
  },
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok", "demoMode", "version"],
                  properties: {
                    ok: { type: "boolean" },
                    demoMode: { type: "boolean" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/sanitize": {
      post: {
        summary: "Sanitise a single document",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: SANITIZE_REQUEST_SCHEMA },
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  config: { type: "string", description: "JSON-encoded SanitizeConfig." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Sanitisation result (verdict may be allow/warn/block).",
            content: { "application/json": { schema: SANITIZE_RESPONSE_SCHEMA } },
          },
          "400": {
            description: "Malformed request.",
            content: { "application/json": { schema: SANITIZE_ERROR_SCHEMA } },
          },
          "413": {
            description: "Payload too large.",
            content: { "application/json": { schema: SANITIZE_ERROR_SCHEMA } },
          },
          "415": {
            description: "Unsupported media type.",
            content: { "application/json": { schema: SANITIZE_ERROR_SCHEMA } },
          },
          "502": {
            description: "Upstream model unavailable.",
            content: { "application/json": { schema: SANITIZE_ERROR_SCHEMA } },
          },
        },
      },
    },
    "/api/v1/sanitize/batch": {
      post: {
        summary: "Sanitise up to 25 documents in a single call",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["items"],
                properties: {
                  items: {
                    type: "array",
                    minItems: 1,
                    maxItems: 25,
                    items: SANITIZE_REQUEST_SCHEMA,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Batch result. Per-item errors are returned inline; the batch itself only fails on validation.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status", "results"],
                  properties: {
                    status: { type: "string", enum: ["success"] },
                    results: { type: "array", items: SANITIZE_RESPONSE_SCHEMA },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid batch payload (missing items, too many items, etc).",
            content: { "application/json": { schema: SANITIZE_ERROR_SCHEMA } },
          },
        },
      },
    },
    "/api/metrics": {
      get: {
        summary: "Prometheus metrics",
        responses: {
          "200": {
            description: "Prometheus text exposition.",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/api/openapi": {
      get: {
        summary: "OpenAPI document",
        responses: {
          "200": {
            description: "This OpenAPI 3.1 document.",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
  },
};

export async function GET() {
  return Response.json(OPENAPI_DOC);
}
