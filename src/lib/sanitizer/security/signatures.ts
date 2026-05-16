const INJECTION_SIGNATURES: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompt)/i,
  /you\s+are\s+now\s+(in\s+)?(developer|dev|god|admin|jailbreak|unrestricted)\s+mode/i,
  /\[?\s*system\s*\]?\s*:/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(different|new|another|unrestricted|evil|uncensored)\s+(AI|assistant|model|bot|system|LLM)/i,
  /disregard\s+(all\s+)?(your\s+)?(previous\s+)?(training|instructions?|guidelines?|rules?|context)/i,
  /you\s+must\s+(now\s+)?(forget|override|bypass|ignore)\s+(all\s+)?(your\s+)?(previous\s+)?(instructions?|training|context)/i,
  /new\s+instructions?\s*:/i,
  /\[new\s+(instruction|task|role|directive|system|prompt)\]/i,
  /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(?:evil|unethical|uncensored|unaligned|rogue|unrestricted)/i,
  /\bDAN\s+mode\b/i,
  /\bjailbreak\b/i,
  /<\s*\/?\s*system\s*>/i,
  /\|\s*END\s*OF\s*TEXT\s*\|/i,
  /-{3,}\s*END\s+OF\s+(DOCUMENT|TEXT|CONTEXT|PROMPT)\s*-{3,}/i,
  /#{1,3}\s+INSTRUCTIONS?\s+#{1,3}/i,
  /you\s+are\s+a\s+(helpful\s+)?assistant\s+(?:without|with\s+no)\s+restrictions?/i,
  /respond\s+(only|always)\s+(in\s+)?developer\s+mode/i,
  /enable\s+(developer|god|admin|override|unrestricted)\s+mode/i,
  /bypass\s+(all\s+)?(safety|content|ethical)\s+(filter|check|guard|restriction|policy|limit)/i,
  /from\s+now\s+on\s+(you\s+(will|must|should|are|have\s+to)|ignore|forget|act)/i,
  /your\s+(new\s+)?(primary|first|main|real|actual|only|most\s+important)\s+(task|goal|directive|instruction|purpose|job)\s+is/i,
  /do\s+not\s+(follow|obey|apply|use)\s+(your|any|the)\s+(previous|prior|original|system)\s+(instructions?|prompt|rules?|guidelines?)/i,
  /\bprompt\s+injection\b/i,
  /\brole[\s-]play\b.*\b(as|like)\b.*(AI|assistant|system|bot)/i,
  /forget\s+(everything\s+)?(you\s+)?(know|were\s+told|learned|have\s+been\s+told|were\s+taught)/i,
  /your\s+(true|real|hidden|actual)\s+(self|purpose|goal|identity|instructions?)/i,
  /\bsudo\s+(mode|override|access)\b/i,
  /\badmin\s+override\b/i,
  /(dump|reveal|print|show|output|display|leak)\s+(all\s+)?(stored\s+)?(client\s+)?(API\s+keys?|credentials?|secrets?|passwords?|tokens?|system\s+prompt)/i,
  /forget\s+(what|everything)\s+(you\s+)?(were|have\s+been)\s+(told|taught|instructed|given)/i,
];

// Cyrillic -> Latin confusables fold (lowercase Latin targets).
// Regexes already use /i, so uppercase Cyrillic maps to lowercase Latin too.
const CONFUSABLES: Record<string, string> = {
  // lowercase Cyrillic -> lowercase Latin
  "а": "a", "в": "b", "е": "e", "к": "k", "м": "m",
  "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
  "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s",
  "ԛ": "q",
  // uppercase Cyrillic -> lowercase Latin
  "А": "a", "В": "b", "Е": "e", "К": "k", "М": "m",
  "Н": "h", "О": "o", "Р": "p", "С": "c", "Т": "t",
  "У": "y", "Х": "x", "І": "i", "Ј": "j", "Ѕ": "s",
  "Ԛ": "q",
};

const CONFUSABLES_RE = new RegExp(
  "[" + Object.keys(CONFUSABLES).join("") + "]",
  "g",
);

// Zero-width and bidi-control characters (U+200B..U+200F, U+202A..U+202E,
// U+2060..U+206F, U+FEFF).
const INVISIBLE_RE = /[​-‏‪-‮⁠-⁯﻿]/g;

export function normalizeForDetection(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE_RE, "")
    .replace(CONFUSABLES_RE, (ch) => CONFUSABLES[ch] ?? ch);
}

export function containsInjection(text: string): boolean {
  const normalized = normalizeForDetection(text);
  return INJECTION_SIGNATURES.some((re) => re.test(normalized));
}
