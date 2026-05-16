# Sentry Safety API

## Endpoint

`POST /api/v1/sanitize`

Stateless. No auth enforced in MVP — the `x-api-key` header is accepted but ignored. Rate-limit hook exists but is not active.

## Request

Two shapes, content-negotiated by `Content-Type`.

### JSON (text or base64 file)

```http
POST /api/v1/sanitize HTTP/1.1
Content-Type: application/json
x-api-key: demo

{
  "filename": "vendor-quote.txt",
  "content": "...raw text...",
  "metadata": { "source": "email" },
  "config": {
    "privacy": {
      "mask_pii": true,
      "entities_to_mask": ["PERSON", "ORGANIZATION", "LOCATION", "CREDIT_CARD", "PHONE", "EMAIL", "IBAN", "IP"]
    },
    "security": {
      "block_injections": true,
      "max_decompression_ratio": 100,
      "strip_macros": true
    },
    "integrity": {
      "check_autophagy": false
    }
  }
}
```

Alternative file-in-JSON shape:

```json
{
  "filename": "resume.pdf",
  "file_base64": "JVBERi0xLjQKJcOkw7zDts...",
  "config": { ... }
}
```

### Multipart (file upload, used by the dashboard)

```http
POST /api/v1/sanitize HTTP/1.1
Content-Type: multipart/form-data; boundary=...

file=@./resume.pdf
config={...}
```

Max payload (MVP): **1 MB** of extracted text. PDFs are flattened to text server-side before scanning.

### Config defaults

If `config` is missing, defaults apply:

```json
{
  "privacy":   { "mask_pii": true, "entities_to_mask": ["PERSON", "CREDIT_CARD", "PHONE", "EMAIL", "IBAN", "IP"] },
  "security":  { "block_injections": true, "max_decompression_ratio": 100, "strip_macros": true },
  "integrity": { "check_autophagy": false }
}
```

## Response

Always `200 OK` with the verdict in body, unless the request itself is malformed (`400`) or the engine crashed (`5xx`). **"This document is malicious" is not an error.**

```json
{
  "status": "success",
  "scanId": "scn_01HXYZ...",
  "verdict": "block",
  "clean_text": "Користувач [PERSON_1] зробив замовлення з номера [PHONE_1].",
  "tokenMap": {
    "PERSON_1": "Богдана В.",
    "PHONE_1":  "+380501234567"
  },
  "metadata": {
    "pii_masked_count": 2,
    "threats_blocked": {
      "zip_bombs": 0,
      "mime_mismatch": 0,
      "macros_stripped": 0,
      "prompt_injections": 1
    },
    "synthetic_spam_removed": false,
    "layer1": {
      "verdict": "warn",
      "removed_paragraphs": 1
    },
    "layer2": {
      "verdict": "block",
      "score": 0.94,
      "demoMode": false,
      "agents": {
        "semantic": { "verdict": "block", "score": 0.94 },
        "logic":    { "verdict": "allow", "score": 0.05 }
      }
    },
    "layer3": {
      "enabled": false
    }
  },
  "latencyMs": 812
}
```

### Field semantics

| Field | Type | Notes |
|-------|------|-------|
| `status` | `"success" \| "error"` | High-level outcome. Adversarial content returns `"success"` with `verdict: "block"`, not an error. |
| `scanId` | string | Opaque. Useful for the dashboard log column. |
| `verdict` | `"allow" \| "warn" \| "block"` | Fused decision across all enabled layers. UI should colour-code. |
| `clean_text` | string | Layer 1 output with PII replaced by tokens and injection paragraphs removed. Safe to forward to downstream LLM. |
| `tokenMap` | `Record<string, string>` | Reverse map of token → original value. Returned only to authenticated callers. Treat as sensitive. |
| `metadata.threats_blocked` | object | Per-class counters from Layer 1. |
| `metadata.pii_masked_count` | number | Total PII entities replaced. |
| `metadata.synthetic_spam_removed` | boolean | True if Layer 3 ran and dropped any paragraph. |
| `metadata.layer1` | object | Per-layer detail. Used by the dashboard's "Agent Trail". |
| `metadata.layer2.demoMode` | boolean | True when Layer 2 came from the mock shim — either because `DEMO_MODE=true` was set in env **or** because the Denis Space was unreachable and we fell back to `mockLayer2()`. UI should show a "MOCK" badge. |
| `metadata.layer2.agents.semantic` | object | Denis classifier output: `{ verdict, score }` where `score` is `poison_probability`. |
| `metadata.layer2.agents.logic` | object | Shape placeholder for dashboard backwards-compat. Always `{ verdict: "allow", score: 0 }`. |
| `metadata.layer3.enabled` | boolean | True only when the request opted into integrity check. |
| `latencyMs` | number | End-to-end. |

The canonical TypeScript shape lives in [`src/types/scan.ts`](../src/types/scan.ts). **That file wins** if this doc and the code disagree — fix the doc.

## Error responses

```json
{
  "status": "error",
  "error": "payload_too_large",
  "message": "Document exceeds 1 MB after text extraction."
}
```

| Code | `error` | When |
|------|---------|------|
| 400 | `invalid_payload` | Missing `content`/`file`, bad JSON, unknown config key. |
| 400 | `encrypted_archive` | Password-protected archive — we refuse to attempt decryption. |
| 413 | `payload_too_large` | After text extraction, or zip-bomb decompression ratio exceeded. |
| 415 | `unsupported_media_type` | Unknown MIME, or MIME-magic mismatch (e.g. `.pdf` extension on an `.exe`). |
| 429 | `rate_limited` | Too many requests — token bucket (60 burst, 1 rps refill) per IP. |
| 500 | `engine_error` | Unhandled exception in any layer. |
| 502 | `model_unavailable` | Layer 2 Denis ML call failed and `DEMO_MODE` was not set. Caller may retry. (With the new fallback shim, this code may never fire in practice — a Denis outage falls back to `mockLayer2()` instead of erroring.) |

## DEMO_MODE

When the server has `DEMO_MODE=true` in env:

- **Layer 1 still runs normally.** PII masking, zip-bomb checks, MIME validation, and injection signatures are unaffected.
- **Layer 2 short-circuits** to `mockLayer2()` — a deterministic shim that pattern-matches a small list of injection markers on the Layer-1-sanitised text. **Denis ML is not called.**
- The same shim is used as a fallback when the Denis Space is unreachable, even if `DEMO_MODE=false`.
- `metadata.layer2.demoMode: true` so the UI can label the response. This flag is `true` when either the `DEMO_MODE` env is set **or** the Denis fallback was triggered.
- Latency is artificially padded to ~600 ms so the demo feels real.

This is the failsafe for live presentation. Treat it as a first-class code path, not a hack.

## Health check

`GET /api/health` — returns `{ "ok": true, "demoMode": boolean, "version": "..." }`. Used by the pre-demo smoke test.

## Additional endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/v1/sanitize/batch` | POST | Array form: `{ "items": [SanitizeRequest, ...] }`, max 25 items, concurrency 5. Returns `{ "status": "success", "results": [SanitizeResponse, ...] }`. Per-item errors become `SanitizeError` entries — the batch itself returns 200. `tokenMap` is never included in batch results. |
| `GET /api/metrics` | GET | Prometheus exposition format. Counters: `sentry_scans_total{verdict}`, `sentry_errors_total{code}`, `sentry_rate_limited_total`, `sentry_layer2_failures_total{reason}`, `sentry_layer2_cache_hits_total`, `sentry_idempotency_hits_total`. Histograms: `sentry_scan_latency_ms`, `sentry_layer{1,2,3}_latency_ms`. |
| `GET /api/openapi` | GET | OpenAPI 3.1 spec in JSON. |

## Response headers (sanitize)

Every successful `POST /api/v1/sanitize` response includes:

| Header | Value |
|--------|-------|
| `x-scan-id` | Same as `body.scanId` |
| `x-latency-l1-ms` | Layer 1 wall-clock ms |
| `x-latency-l2-ms` | Layer 2 wall-clock ms |
| `x-latency-l3-ms` | Layer 3 wall-clock ms (0 when disabled) |
| `x-rate-remaining` | Remaining tokens in the current rate-limit window |

## Idempotency

Send `Idempotency-Key: <uuid>` header to cache the response for 5 minutes. Replayed responses include `x-idempotent-replay: true`.
