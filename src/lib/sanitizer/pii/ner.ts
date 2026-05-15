import type { PiiEntity } from "@/types/scan";
import type { PiiMatch } from "./regex";

const WINK_TO_PII: Record<string, PiiEntity> = {
  PERSON: "PERSON",
  ORG: "ORGANIZATION",
  LOC: "LOCATION",
  GPE: "LOCATION",
  FAC: "LOCATION",
};

let _nlp: unknown = null;
let _its: unknown = null;
let _loadAttempted = false;

function getNlp(): { nlp: unknown; its: unknown } | null {
  if (_nlp) return { nlp: _nlp, its: _its };
  if (_loadAttempted) return null;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const winkNLP = require("wink-nlp");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const model = require("wink-eng-lite-web-model");
    _nlp = winkNLP(model);
    _its = (_nlp as { its: unknown }).its;
    return { nlp: _nlp, its: _its };
  } catch {
    return null;
  }
}

export function findNerPii(text: string): PiiMatch[] {
  const ctx = getNlp();
  if (!ctx) return [];

  try {
    const { nlp, its } = ctx as {
      nlp: { readDoc: (t: string) => { entities: () => { each: (fn: (e: unknown) => void) => void } } };
      its: { type: unknown };
    };

    const doc = nlp.readDoc(text);
    const seen = new Map<string, PiiEntity>();

    doc.entities().each((entity: unknown) => {
      const e = entity as { out: (x?: unknown) => string };
      const label = e.out(its.type);
      const piiType = WINK_TO_PII[label];
      if (!piiType) return;
      const value = e.out();
      if (value && value.length > 1) seen.set(value, piiType);
    });

    const results: PiiMatch[] = [];
    for (const [value, type] of seen.entries()) {
      let idx = 0;
      while (true) {
        const pos = text.indexOf(value, idx);
        if (pos === -1) break;
        results.push({ type, value, start: pos, end: pos + value.length });
        idx = pos + value.length;
      }
    }
    return results;
  } catch {
    return [];
  }
}
