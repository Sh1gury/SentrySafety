import type { Layer3Report } from "@/types/scan";

/**
 * Layer 3 — AI-generated content detector (opt-in via config.integrity.check_autophagy).
 *
 * Strategy:
 *   1. Hugging Face Inference API (`roberta-base-openai-detector`) — real model, no key.
 *   2. Heuristic fallback on AI-filler phrases + bullet density when HF is down.
 *
 * (Groq path retired alongside Layer 2 — see layer2Pipeline.ts.)
 */
export async function runLayer3(
  cleanText: string,
  opts: { enabled: boolean }
): Promise<Layer3Report> {
  if (!opts.enabled) return { enabled: false };

  try {
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/roberta-base-openai-detector",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: cleanText.slice(0, 2000) }), // limit size
      },
    );

    if (hfRes.ok) {
      const result = await hfRes.json();
      let labels: Array<{ label: string; score: number }> = [];
      if (Array.isArray(result)) {
        labels = (Array.isArray(result[0]) ? result[0] : result) as Array<{
          label: string;
          score: number;
        }>;
      }

      if (labels.length > 0) {
        const fakeLabel = labels.find(
          (r) => r.label === "Fake" || r.label === "LABEL_1",
        );
        const confidence = fakeLabel ? fakeLabel.score : 0;
        return {
          enabled: true,
          synthetic_paragraphs_removed: confidence > 0.6 ? 1 : 0,
          confidence: confidence,
        };
      }
    } else {
      console.warn(
        "[Layer3] HF API not ok:",
        hfRes.status,
        await hfRes.text().catch(() => ""),
      );
    }
  } catch {
    console.warn("[Layer3] HF API failed, falling back to heuristic");
  }

  // Fallback heuristic if HF is down
  const lower = cleanText.toLowerCase();
  const aiPhrases = [
    "as an ai", "as a language model", "in conclusion", "it is important to note",
    "delve into", "tapestry", "seamlessly", "revolutionize", "foster",
    "multifaceted", "ever-evolving", "landscape", "testament to", "crucial",
    "robust", "dynamic", "synergy", "navigate", "realm", "pivotal",
    "in today's", "in recent years", "it goes without saying",
    "needless to say", "shed light on", "beacon of", "testament to the",
    "let's dive in", "here's a", "here are", "certainly", "of course",
    "i'm happy to help", "as an artificial intelligence", "my training data",
    "i can certainly", "sure!", "however,", "moreover,", "additionally,",
    "comprehensive", "intricate", "paramount", "embark on", "treasure trove",
  ];
  let matchCount = 0;
  for (const phrase of aiPhrases) {
    if (lower.includes(phrase)) matchCount++;
  }

  // Check if there's an excessive amount of bullet points (common in LLM output)
  const bulletCount = (cleanText.match(/^[-*]\s/gm) || []).length;
  if (bulletCount >= 3) matchCount += 2;

  // Check paragraph count
  const paragraphs = cleanText.split(/\n\s*\n/).length;

  let confidence = 0.05;
  let paragraphsRemoved = 0;

  if (matchCount >= 2) {
    confidence = Math.min(0.99, 0.4 + matchCount * 0.1);
    paragraphsRemoved = Math.min(paragraphs, Math.max(1, Math.floor(matchCount / 2)));
  } else if (matchCount === 1) {
    confidence = 0.35;
  }

  return {
    enabled: true,
    synthetic_paragraphs_removed: paragraphsRemoved,
    confidence: confidence,
  };
}
