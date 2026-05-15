/**
 * Unit test — sandwich prompt builder.
 * Run with: npx tsx tests/unit-prompts.ts
 */

import { buildSandwich } from "../src/lib/ai/prompts/sandwich";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`  FAIL  ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  pass  ${label}`);
  }
}

console.log("Sentry Safety unit test → buildSandwich");

const { system, user } = buildSandwich("hdr", "DOC", "{schema}", "CANARY_XYZ");

// Canary appears exactly once in system
console.log("\n[1] Canary in system, exactly once");
{
  const matches = system.match(/CANARY_XYZ/g) ?? [];
  assert("CANARY_XYZ present", matches.length >= 1);
  assert("CANARY_XYZ appears exactly once", matches.length === 1);
}

// jsonSchema substring present
console.log("\n[2] jsonSchema substring present in system");
assert("system contains '{schema}'", system.includes("{schema}"));

// Header at the top
console.log("\n[3] Header at the top of system");
assert("system starts with 'hdr'", system.startsWith("hdr"));

// User wraps doc in <document>...</document>
console.log("\n[4] User wraps doc in <document>...</document>");
assert("user contains <document>", user.includes("<document>"));
assert("user contains </document>", user.includes("</document>"));
assert("user contains the doc body 'DOC'", user.includes("\nDOC\n"));

// User contains 'Reply ONLY with JSON'
console.log("\n[5] User contains 'Reply ONLY with JSON'");
assert("reply phrase present", user.includes("Reply ONLY with JSON"));

console.log(process.exitCode ? "\nSome tests FAILED." : "\nAll tests passed.");
