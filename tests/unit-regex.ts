/**
 * Unit test — pure regex PII detector.
 * Run with: npx tsx tests/unit-regex.ts
 */

import { findRegexPii } from "../src/lib/sanitizer/pii/regex";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`  FAIL  ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  pass  ${label}`);
  }
}

function hasType(matches: { type: string }[], type: string): boolean {
  return matches.some((m) => m.type === type);
}

console.log("Sentry Safety unit test → regex PII");

// Empty string
console.log("\n[1] Empty string");
{
  const out = findRegexPii("");
  assert("returns empty array", Array.isArray(out) && out.length === 0);
}

// Credit card — valid Luhn
console.log("\n[2] Valid credit card (Luhn passes)");
{
  const out = findRegexPii("Pay with 4111 1111 1111 1111 today.");
  assert("CREDIT_CARD detected", hasType(out, "CREDIT_CARD"));
}

// Credit card — invalid Luhn
console.log("\n[3] Invalid Luhn credit card");
{
  const out = findRegexPii("Pay with 4111 1111 1111 1112 today.");
  assert("no CREDIT_CARD match", !hasType(out, "CREDIT_CARD"));
}

// IBAN — valid mod-97
console.log("\n[4] Valid IBAN (GB82WEST...)");
{
  const out = findRegexPii("Wire to GB82WEST12345698765432 please.");
  assert("IBAN detected", hasType(out, "IBAN"));
}

// IBAN — mangled
console.log("\n[5] Mangled IBAN");
{
  const out = findRegexPii("Wire to GB99WEST12345698765432 please.");
  assert("no IBAN match", !hasType(out, "IBAN"));
}

// Email
console.log("\n[6] Email");
{
  const out = findRegexPii("Contact anna@test.co for details.");
  assert("EMAIL detected", hasType(out, "EMAIL"));
}

// Phone
console.log("\n[7] Phone");
{
  const out = findRegexPii("Call us at +1 415-555-0199 today.");
  assert("PHONE detected", hasType(out, "PHONE"));
}

// IP
console.log("\n[8] IP address");
{
  const out = findRegexPii("Server at 192.168.1.10 is responding.");
  assert("IP detected", hasType(out, "IP"));
}

console.log(process.exitCode ? "\nSome tests FAILED." : "\nAll tests passed.");
