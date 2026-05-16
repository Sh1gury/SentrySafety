import { logger } from '@/lib/logger';

const SPACE_URL = (process.env.DENIS_SPACE_URL ?? 'https://zonda001-poison-defense.hf.space').replace(/\/$/, '');
const API_KEY = (process.env.DENIS_API_KEY ?? '').trim();
const TIMEOUT_MS = 12_000;

export interface DenisScanResult {
  safe: boolean;
  trust_weight: number;
  poison_probability: number;
  predicted_attack_type: string;
}

/**
 * Calls Denis's Gradio Space /scan_text endpoint.
 * Gradio 5.x REST pattern: POST /gradio_api/call/{fn} → event_id, then GET /gradio_api/call/{fn}/{id} → SSE.
 * Both image and text models live at the same Space URL; this targets only /scan_text.
 */
export async function scanTextDenis(text: string): Promise<DenisScanResult> {
  const submitRes = await fetch(`${SPACE_URL}/gradio_api/call/scan_text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ data: [API_KEY, text.slice(0, 5000)] }),
  });

  if (!submitRes.ok) {
    throw new Error(`Denis Gradio submit ${submitRes.status}: ${await submitRes.text().catch(() => '')}`);
  }

  const { event_id } = await submitRes.json() as { event_id: string };

  const pollRes = await fetch(`${SPACE_URL}/gradio_api/call/scan_text/${event_id}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
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
