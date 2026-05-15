/**
 * HTML text extractor — Layer 1.
 *
 * Pure regex/string: no DOM, no parser dependency. We intentionally do not
 * execute or interpret any markup; this is a firewall, not a renderer.
 */
export function extractHtmlText(buf: Buffer): string {
  let text = buf.toString("utf-8");

  // Strip executable / styling blocks entirely (including their contents).
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Strip HTML comments.
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Replace block-level closers and line breaks with newlines so paragraph
  // boundaries survive tag removal.
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/br>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n");

  // Remove every remaining tag.
  text = text.replace(/<[^>]+>/g, "");

  // Decode the five core HTML entities (plus &apos;).
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Collapse whitespace runs.
  text = text.replace(/ {2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
