import type { PiiEntity } from "@/types/scan";

export interface PiiMatch {
  type: PiiEntity;
  value: string;
  start: number;
  end: number;
}

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, "").split("").map(Number);
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function ibanCheck(raw: string): boolean {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55)
  );
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + parseInt(ch, 10)) % 97;
  return rem === 1;
}

interface PatternDef {
  type: PiiEntity;
  re: RegExp;
  validate?: (m: string) => boolean;
}

const PATTERNS: PatternDef[] = [
  {
    type: "IBAN",
    re: /\b[A-Z]{2}\d{2}[\s]?[A-Z0-9]{4}(?:[\s]?[A-Z0-9]{4}){2,7}(?:[\s]?[A-Z0-9]{1,4})?\b/g,
    validate: ibanCheck,
  },
  {
    type: "CREDIT_CARD",
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnCheck(digits);
    },
  },
  {
    type: "EMAIL",
    re: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
  },
  {
    type: "PHONE",
    re: /(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s])\d{3,10}(?:[-.\s]\d{2,6})*\b/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, "").length;
      return digits >= 9 && digits <= 15;
    },
  },
  {
    type: "IP",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
  {
    type: "PERSON",
    // Catches "My name is John Smith", "I am Jane Doe", "name: John Smith", etc.
    re: /(?:my\s+name\s+is|i\s+am|i'm|name\s*[:=])\s+((?:[A-Z][a-z]{1,20})(?:\s+[A-Z][a-z]{1,20}){1,3})/gi,
  },
];

export function findRegexPii(text: string): PiiMatch[] {
  const results: PiiMatch[] = [];
  // Track matched ranges so later patterns don't overlap (e.g. PHONE inside IBAN)
  const taken: Array<[number, number]> = [];

  for (const { type, re, validate } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (validate && !validate(m[0])) continue;
      // For patterns with capture groups (like PERSON), use the group as value
      const value = m[1] ?? m[0];
      const start = m[1] ? m.index + m[0].indexOf(m[1]) : m.index;
      const end = start + value.length;
      // Skip if this match overlaps with a previously matched range
      if (taken.some(([ts, te]) => start < te && end > ts)) continue;
      results.push({ type, value, start, end });
      taken.push([start, end]);
    }
  }
  return results.sort((a, b) => a.start - b.start);
}
