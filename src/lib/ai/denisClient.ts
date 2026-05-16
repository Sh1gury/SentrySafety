import { logger } from '@/lib/logger';

const SPACE_URL = (process.env.DENIS_SPACE_URL ?? 'https://zonda001-poison-defense.hf.space').replace(/\/$/, '');
const API_KEY = (process.env.DENIS_API_KEY ?? '').trim();
const SUBMIT_TIMEOUT_MS = 60_000;   // Space may need 30-60s to wake from sleep
const POLL_TIMEOUT_MS   = 30_000;

export interface DenisScanResult {
  safe: boolean;
  trust_weight: number;
  poison_probability: number;
  predicted_attack_type: string;       // "clean" | "prompt_injection"
  attack_distribution?: Record<string, number>;
  input_length?: number;
}

/**
 * Calls Denis's Gradio Space /scan_text endpoint.
 * Denis uses a fine-tuned transformer (Zonda001/poison-defense-text) for text,
 * and a CNN detector for images — both live at the same Space URL.
 * Gradio 5.x REST: POST /gradio_api/call/{fn} → event_id, GET …/{id} → SSE.
 */
export async function scanTextDenis(text: string): Promise<DenisScanResult> {
  const submitRes = await fetch(`${SPACE_URL}/gradio_api/call/scan_text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    body: JSON.stringify({ data: [API_KEY, text.slice(0, 5000)] }),
  });

  if (!submitRes.ok) {
    throw new Error(`Denis Gradio submit ${submitRes.status}: ${await submitRes.text().catch(() => '')}`);
  }

  const { event_id } = await submitRes.json() as { event_id: string };

  const pollRes = await fetch(`${SPACE_URL}/gradio_api/call/scan_text/${event_id}`, {
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });

  if (!pollRes.ok) {
    throw new Error(`Denis Gradio poll ${pollRes.status}`);
  }

  const sseBody = await pollRes.text();

  // Gradio SSE has two formats depending on version:
  // v5: "event: complete\ndata: [{...}]"  (array directly)
  // v4: "data: {msg: 'process_completed', output_data: [{...}]}"
  let nextDataIsResult = false;
  for (const line of sseBody.split('\n')) {
    if (line.startsWith('event:') && line.includes('complete')) {
      nextDataIsResult = true;
      continue;
    }
    if (!line.startsWith('data:')) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    if (nextDataIsResult && Array.isArray(parsed)) {
      return (parsed as DenisScanResult[])[0];
    }
    const obj = parsed as { msg?: string; output_data?: unknown[] };
    if (obj.msg === 'process_completed' && Array.isArray(obj.output_data)) {
      return obj.output_data[0] as DenisScanResult;
    }
  }

  logger.warn({ sseBody: sseBody.slice(0, 300) }, 'Denis Gradio: unexpected SSE format');
  throw new Error('Denis Gradio: no complete event in stream');
}
