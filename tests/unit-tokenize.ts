/**
 * Unit test — token map / masking.
 * Run with: npx tsx tests/unit-tokenize.ts
 */

import { tokenize } from "../src/lib/sanitizer/pii/tokenize";
import type { PiiMatch } from "../src/lib/sanitizer/pii/regex";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`  FAIL  ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  pass  ${label}`);
  }
}

console.log("Sentry Safety unit test → tokenize");

// Stable tokens: same value in two places → same token
console.log("\n[1] Stable tokens for repeated values");
{
  const text = "Email anna@test.co or anna@test.co again.";
  const v = "anna@test.co";
  const matches: PiiMatch[] = [];
  let idx = text.indexOf(v);
  while (idx !== -1) {
    matches.push({ type: "EMAIL", value: v, start: idx, end: idx + v.length });
    idx = text.indexOf(v, idx + 1);
  }
  const out = tokenize(text, matches);
  assert("two matches collapsed to one token", out.count === 2);
  assert("masked text contains [EMAIL_1] twice",
    (out.maskedText.match(/\[EMAIL_1\]/g) ?? []).length === 2);
  assert("token map has EMAIL_1 → original",
    out.tokenMap["EMAIL_1"] === v);
  assert("no EMAIL_2 produced", out.tokenMap["EMAIL_2"] === undefined);
}

// Adjacent matches — non-overlapping
console.log("\n[2] Two adjacent matches don't break each other");
{
  const text = "anna@test.co bob@test.co";
  const matches: PiiMatch[] = [
    { type: "EMAIL", value: "anna@test.co", start: 0, end: 12 },
    { type: "EMAIL", value: "bob@test.co", start: 13, end: 24 },
  ];
  const out = tokenize(text, matches);
  assert("both kept", out.count === 2);
  assert("masked has EMAIL_1", out.maskedText.includes("[EMAIL_1]"));
  assert("masked has EMAIL_2", out.maskedText.includes("[EMAIL_2]"));
  assert("masked has space between", out.maskedText === "[EMAIL_1] [EMAIL_2]");
}

// Counter continuity across passes
console.log("\n[3] Counter continuity via existingCounters");
{
  const text = "Reach bob@test.co.";
  const matches: PiiMatch[] = [
    { type: "EMAIL", value: "bob@test.co", start: 6, end: 17 },
  ];
  const out = tokenize(text, matches, { EMAIL: 3 });
  assert("continues from 4", out.maskedText.includes("[EMAIL_4]"));
  assert("token map has EMAIL_4", out.tokenMap["EMAIL_4"] === "bob@test.co");
  assert("no EMAIL_1 produced", out.tokenMap["EMAIL_1"] === undefined);
}

// Empty matches → unchanged
console.log("\n[4] Empty matches → text untouched");
{
  const out = tokenize("hello world", []);
  assert("masked = original", out.maskedText === "hello world");
  assert("count 0", out.count === 0);
  assert("tokenMap empty", Object.keys(out.tokenMap).length === 0);
}

console.log(process.exitCode ? "\nSome tests FAILED." : "\nAll tests passed.");
