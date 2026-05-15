# Live Demo Plan

The whole product is designed around a ~4-minute live demo for the Infomatrix jury. Every other priority is downstream of this.

## The demo story (~4 minutes)

1. **Hook (~30s).** Open the landing page. One sentence: "Enterprise RAG systems are getting poisoned through their own document supply chains, and they are leaking PII to OpenAI on the way in. Sentry Safety is the three-layer firewall that sits in front of the vector store."
2. **The villain (~45s).** Open the Threat Inspector. Drag-and-drop a poisoned PDF (a "vendor proposal" with hidden-text injection + real-looking PII). Toggle **X-Ray** — invisible attacker text becomes visible.
3. **The save (~90s).** Hit Sanitize. The dashboard shows the three layers in sequence:
   - Layer 1 lights up: "Masked 4 PII entities (2 names, 1 phone, 1 IBAN). Removed 1 injection paragraph by signature."
   - Layer 2 lights up: "Semantic agent: block (0.94). Logic agent: allow (0.05). Reason: rephrased jailbreak detected."
   - Verdict: `block`. **Highlight that OpenAI only saw `[PERSON_1] ... [IBAN_1] ...`, never the real values.**
4. **The integration (~45s).** Switch to the docs page. Show the SDK snippet:
   ```ts
   import { SentrySafety } from "@sentry-safety/sdk";
   const shield = new SentrySafety({ apiKey });
   const { clean_text, verdict } = await shield.sanitize(file, config);
   if (verdict !== "allow") throw new Error("blocked");
   // clean_text is safe to embed
   ```
   "One line. Drop it in front of any RAG pipeline."
5. **Close (~30s).** "Three layers. PII never reaches the LLM. That is Sentry Safety." Hand to Q&A.

## Failure modes and their fallbacks

| Failure | Fallback |
|---------|----------|
| Venue Wi-Fi dies | `DEMO_MODE=true` makes Layer 2 use the deterministic shim. Layer 1 + Layer 3 are unaffected. Verify before going on stage by toggling airplane mode and re-running the demo. |
| OpenAI quota / rate limit | Same as above. |
| File upload throws | Pre-load a known-good poisoned PDF in `public/demo/` and have a "Try this sample" button. |
| Dashboard crashes mid-demo | Keep `/api/v1/sanitize` reachable via curl as a fallback narrative ("here is the raw verdict, the visual is a wrapper"). |

## Pre-demo checklist

Run this in the **15 minutes before** going on stage:

- [ ] `DEMO_MODE=true` works end-to-end in airplane mode (Layers 1 + mocked 2).
- [ ] `DEMO_MODE=false` works end-to-end with venue Wi-Fi (Layers 1 + real 2).
- [ ] The poisoned sample PDF in `public/demo/` triggers a `block` in both modes.
- [ ] X-Ray toggle works on the sample PDF.
- [ ] `pii_masked_count` is non-zero on the sample (proves Layer 1 is alive).
- [ ] Landing page loads under 2 s.
- [ ] No `console.error` in the browser console on the demo path.
- [ ] Laptop battery > 60%, charger in bag.
- [ ] `tests/smoke.ts` passes.

## What we do NOT show

- Auth / Supabase. Not part of the story.
- Internal prompts. Even if asked. Pitch them as IP.
- Layer 3 unless someone asks about model collapse. It is opt-in and irrelevant to a closed-corporate-RAG audience.
