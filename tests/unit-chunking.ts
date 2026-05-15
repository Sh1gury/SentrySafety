/**
 * Unit test — chunkText.
 * Run with: npx tsx tests/unit-chunking.ts
 */

import { chunkText } from "../src/lib/ai/chunking";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`  FAIL  ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  pass  ${label}`);
  }
}

console.log("Sentry Safety unit test → chunking");

// Short text → 1 chunk
console.log("\n[1] Short text → 1 chunk");
{
  const out = chunkText("hello world", { maxChars: 100, overlap: 10, maxChunks: 4 });
  assert("single chunk", out.length === 1);
  assert("chunk = original", out[0] === "hello world");
}

// Long text → multiple chunks with overlap
console.log("\n[2] Long text → multiple chunks with overlap");
{
  // 1200 chars of 'a' then 'b' etc. — use a deterministic body without paragraph breaks
  const body = "abcdefghij".repeat(120); // 1200 chars, no "\n\n"
  const out = chunkText(body, { maxChars: 500, overlap: 100, maxChunks: 4 });
  assert("more than 1 chunk", out.length > 1);
  assert("each chunk within maxChars", out.every((c) => c.length <= 500));
  // Check overlap: end of chunk[0] should equal start of chunk[1] for `overlap` chars
  if (out.length >= 2) {
    const tail = out[0].slice(out[0].length - 100);
    const head = out[1].slice(0, 100);
    assert("overlap=100 chars match between chunk 0 and chunk 1", tail === head);
  }
}

// maxChunks cap respected
console.log("\n[3] maxChunks cap respected");
{
  const body = "abcdefghij".repeat(1000); // 10000 chars, no "\n\n"
  const out = chunkText(body, { maxChars: 500, overlap: 50, maxChunks: 3 });
  assert("at most 3 chunks", out.length <= 3);
  assert("exactly 3 chunks for huge body", out.length === 3);
}

// Paragraph boundary preferred when one is in the right region
console.log("\n[4] Paragraph boundary preferred when present in valid region");
{
  // Construct: first 400 chars of 'x', then "\n\n", then 400 chars of 'y', then "\n\n", then more
  // maxChars = 500, so window is [0, 500]. minViableEnd = pos + 250 = 250.
  // We want a "\n\n" between index 250 and 500. Place it at index 400.
  const before = "x".repeat(400);
  const after = "y".repeat(600);
  const text = before + "\n\n" + after; // length 1002
  const out = chunkText(text, { maxChars: 500, overlap: 50, maxChunks: 4 });
  assert("first chunk ends at paragraph boundary", out[0] === "x".repeat(400));
  assert("more than 1 chunk", out.length > 1);
}

console.log(process.exitCode ? "\nSome tests FAILED." : "\nAll tests passed.");
