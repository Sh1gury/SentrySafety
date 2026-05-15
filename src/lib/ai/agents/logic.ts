import { nanoid } from "nanoid";
import { getGroqClient } from "../groqClient";
import { buildLogicPrompt } from "../prompts/logic";
import {
  validateAgentResponse,
  CanaryMismatchError,
  type AgentRawResponse,
} from "../validateLayer2";
import type { AgentVerdict } from "@/types/scan";

const MODEL = "llama-3.3-70b-versatile";
const MAX_ATTEMPTS = 2;
const DEFAULT_TEMPERATURE = 0.1;

export async function runLogicAgent(
  cleanText: string,
  opts: { temperature?: number } = {},
): Promise<AgentVerdict> {
  const groq = getGroqClient();
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const canary = nanoid(16);
    const { system, user } = buildLogicPrompt(cleanText, canary);

    try {
      const completion = await groq.chat.completions.create(
        {
          model: MODEL,
          response_format: { type: "json_object" },
          temperature,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { signal: AbortSignal.timeout(15000) },
      );

      const content = completion.choices[0]?.message?.content ?? "{}";
      const parsed: AgentRawResponse = validateAgentResponse(JSON.parse(content), canary);

      return { verdict: parsed.verdict, score: parsed.score };
    } catch (err) {
      lastError = err;
      if (err instanceof CanaryMismatchError) {
        console.warn(`[logic] attempt ${attempt}: canary mismatch — possible LLM hijack`);
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw new Error(
    `Logic agent failed after ${MAX_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
