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
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g,
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
    re: /(?:\+\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s])?\d{3,4}[-.\s]\d{3,4}\b/g,
    validate: (m) => m.replace(/\D/g, "").length >= 9,
  },
  {
    type: "IP",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
];

export function findRegexPii(text: string): PiiMatch[] {
  const results: PiiMatch[] = [];
  for (const { type, re, validate } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (validate && !validate(m[0])) continue;
      results.push({ type, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  return results.sort((a, b) => a.start - b.start);
}
