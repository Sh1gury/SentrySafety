import type { PiiEntity } from "@/types/scan";
import type { PiiMatch } from "./regex";

const ENTITY_PREFIX: Record<PiiEntity, string> = {
  PERSON: "PERSON",
  ORGANIZATION: "ORG",
  LOCATION: "LOC",
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  CREDIT_CARD: "CARD",
  IBAN: "IBAN",
  IP: "IP",
};

export interface TokenizeResult {
  maskedText: string;
  tokenMap: Record<string, string>;
  count: number;
}

export function tokenize(
  text: string,
  matches: PiiMatch[],
  existingCounters: Record<string, number> = {}
): TokenizeResult {
  if (matches.length === 0) {
    return { maskedText: text, tokenMap: {}, count: 0 };
  }

  // Sort by start position; on ties prefer longer spans
  const sorted = [...matches].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start)
  );

  // Remove overlapping spans — first by position wins
  const deduped: PiiMatch[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.start >= cursor) {
      deduped.push(m);
      cursor = m.end;
    }
  }

  const counters = { ...existingCounters };
  const valueToToken = new Map<string, string>();
  const tokenMap: Record<string, string> = {};

  for (const m of deduped) {
    if (!valueToToken.has(m.value)) {
      const prefix = ENTITY_PREFIX[m.type];
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      const token = `[${prefix}_${counters[prefix]}]`;
      valueToToken.set(m.value, token);
      // Key in map is without brackets so API consumers can look up "PERSON_1"
      tokenMap[`${prefix}_${counters[prefix]}`] = m.value;
    }
  }

  let result = "";
  let pos = 0;
  for (const m of deduped) {
    result += text.slice(pos, m.start);
    result += valueToToken.get(m.value)!;
    pos = m.end;
  }
  result += text.slice(pos);

  return { maskedText: result, tokenMap, count: deduped.length };
}
