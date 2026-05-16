# Sentry Safety — Architecture

## Problem

Modern enterprise RAG systems ingest documents from low-trust supply chains: resumes, vendor PDFs, support tickets, scraped pages. Two things can hurt them:

1. **Confidentiality leak.** Documents contain PII (names, IBAN, cards, phones). When the LLM later retrieves them as context, it can echo that PII to anyone who asks.
2. **Prompt injection via the knowledge base.** Attackers hide instructions inside documents (white-text injections, glyph spoofing, fenced "system" prompts). At retrieval time, the LLM follows the attacker's instructions instead of the company's. This is the LLM-era equivalent of stored XSS.

Existing solutions are post-hoc: they sit between the user and the chatbot and try to catch attacks after retrieval. By then the malicious chunk is already in the prompt, and the PII is already in the vector store.

## Our angle

Sentry Safety is a **pre-RAG firewall**. We scan, sanitise, and anonymise each document before it ever reaches the embedding pipeline. The protected RAG system only ingests documents we cleared.

We run **three layers** in sequence. Each layer adds protection the previous one cannot provide.

## Layer 1 — Deterministic (always on, no LLM)

Local-only, runs on the same Node process as the API. No outbound calls. Roughly 10-50 ms per scan.

| Sub-module | What it does | Library / approach |
|------------|--------------|--------------------|
| PII regex | Find IBAN, credit-card numbers (Luhn-checked), emails, phones, IP addresses | Hand-written regex set in `src/lib/sanitizer/pii/regex.ts` |
| NER | Find names (PERSON), companies (ORGANIZATION), addresses (LOCATION) | `wink-nlp` with the English model |
| Tokenisation | Replace each detected entity with a stable token like `[PERSON_1]`, `[CARD_1]` for the lifetime of the document | `src/lib/sanitizer/tokenize.ts` |
| MIME validation | Compare file magic bytes against declared MIME; reject mismatches | Hand-rolled magic-byte table |
| Zip-bomb guard | Reject archives (incl. DOCX) whose decompression ratio exceeds `config.security.max_decompression_ratio` | Stream-based decompress + counter |
| Macro stripping | Remove VBA macros from Office documents | DOCX = ZIP, drop `vbaProject.bin` |
| Injection signatures | Regex/keyword list for known jailbreaks: "ignore previous instructions", "you are now in dev mode", etc. Paragraphs containing matches are removed. | Static list in `src/lib/sanitizer/signatures.ts` |

**Output of Layer 1:** sanitised text (PII replaced by tokens, dangerous paragraphs stripped) + a token map + a metadata summary. This text is what Layer 2 sees — not the original.

This is the property that makes the product defensible: **the LLM never sees raw PII**. We can say it on stage and prove it in the architecture diagram.

## Layer 2 — Semantic (Denis ML)

Layer 2 is **Denis**, the team's own fine-tuned transformer text classifier (`Zonda001/poison-defense-text`), served from a Gradio Space at `https://zonda001-poison-defense.hf.space`. The route in `src/app/api/v1/sanitize/route.ts` calls `scanTextDenis()` from `src/lib/ai/denisClient.ts`, hands it the raw extracted text, and reads back `{ poison_probability, trust_weight, predicted_attack_type }`.

Denis is a classifier, not a generative model — there is no prompt to inject, so there is no sandwich and no canary. The model is binary: it produces `predicted_attack_type ∈ { "clean", "prompt_injection" }` plus a poison probability used only as an escalation signal.

| Field on `metadata.layer2.agents` | What it carries |
|-----------------------------------|-----------------|
| `semantic` | Denis classifier output: `{ verdict, score }` where `score = poison_probability`. This is the only signal Layer 2 produces. |
| `logic` | **Shape placeholder for dashboard backwards-compat.** Always `{ verdict: "allow", score: 0 }`. Kept because the response DTO in `src/types/scan.ts` still has two agent slots. |

## Layer 3 — Integrity (opt-in, separate provider)

Off by default. Enabled per request via `config.integrity.check_autophagy: true`.

Purpose: detect AI-generated slop ("synthetic spam") to prevent the protected RAG system from being fed its own generation downstream — the well-documented model collapse problem.

Implementation: Hugging Face Inference API (`roberta-base-openai-detector` — public model, no key required) plus a local heuristic fallback (AI-filler phrase matching + bullet-density check) that scores text on entropy and structural-cliché indicators. If HF confidence exceeds 0.6 that the text is AI-generated noise, the paragraph is dropped from the output and counted in `metadata.synthetic_spam_removed`.

Why opt-in: closed corporate knowledge bases ingest human-authored documents and do not need this check; open-internet scrapers (news aggregators, social monitoring) do.

## Verdict fusion

Final verdict is the worst signal across the three layers:

- Any Layer 1 file-level threat (zip-bomb, MIME mismatch, password-protected archive) → `block`, request returns immediately, Layer 2 not invoked.
- Layer 1 injection signature triggered → paragraph removed, contributes `warn` if no other layer escalates.
- Layer 2 verdict comes from Denis. `predicted_attack_type === "clean"` → `allow`. Otherwise the `poison_probability` score escalates: `score >= 0.99` → `block`; `0.96 <= score < 0.99` → `warn`; below `0.96` → `allow`. Denis's transformer scores most text in the 0.90–0.95 band regardless of content, so the binary `predicted_attack_type` is the primary signal and the score only triggers escalation at the high end.
- Layer 3 flagged content → paragraph dropped, no verdict escalation (the goal is filtering, not blocking).

## Component diagram

```
+--------------+      +----------------------+
| Client app   | ---> | Sentry Safety API    |
| (SDK or UI)  |      | POST /api/v1/sanitize|
+--------------+      +----------+-----------+
                                 |
                       +---------v----------+
                       | Layer 1            |
                       | Deterministic      |
                       | regex + NER + MIME |
                       | + zip + macro      |
                       +---------+----------+
                                 |
                       +---------v----------+
                       | Layer 2            |
                       | Denis ML           |
                       | transformer        |
                       | classifier         |
                       | (DEMO_MODE shim)   |
                       +---------+----------+
                                 |
                       +---------v----------+
                       | Layer 3 (opt-in)   |
                       | Autophagy / slop   |
                       +---------+----------+
                                 |
                       +---------v----------+
                       | Unified JSON       |
                       | response           |
                       +--------------------+
```

## DEMO_MODE

`DEMO_MODE=true` short-circuits **only Layer 2** to a deterministic mock (`mockLayer2()`) without calling **Denis**. The same shim is used as a fallback when the Denis Space is unreachable. Layer 1 (regex, NER, MIME, zip) keeps running normally. Layer 3 (opt-in) stays off unless explicitly requested. This means:

- PII still gets masked when offline.
- File-level threats still get caught.
- The semantic verdict comes from pattern matching against a small list of "obvious" injection markers.
- `metadata.layer2.demoMode` is set to `true` so the UI can label the response. This is also set whenever the Denis fallback is taken.

This is the failsafe for live presentation. Treat it as a first-class code path, not a hack.

## What we are explicitly NOT building

- A general-purpose content moderation API.
- A post-retrieval reranker.
- A vector store. We do not store the document; we verdict it and discard.
- An auth product. Supabase is scaffolded in the repo but does not gate the demo flow.
- A malware scanner. We assume the upstream pipeline already runs AV. We catch document-level abuse, not binary payloads.
