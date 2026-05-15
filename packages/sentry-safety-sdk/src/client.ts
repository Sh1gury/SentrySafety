import type { SanitizeRequest, SanitizeSuccess, SanitizeResponse } from "./types";
import { buildError, InvalidPayloadError } from "./errors";

export interface SentrySafetyOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class SentrySafety {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: SentrySafetyOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (
      this.baseUrl.startsWith("http://") &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(this.baseUrl)
    ) {
      console.warn(
        "[SentrySafety] baseUrl uses HTTP — API keys and document content will be transmitted in plaintext. Use HTTPS in production."
      );
    }
  }

  async sanitize(
    input: string | File | Blob,
    config?: SanitizeRequest["config"],
    metadata?: Record<string, string>
  ): Promise<SanitizeSuccess> {
    const body = await this.buildBody(input, config, metadata);
    const response = await this.post(body);
    return response;
  }

  private async buildBody(
    input: string | File | Blob,
    config?: SanitizeRequest["config"],
    metadata?: Record<string, string>
  ): Promise<BodyInit> {
    if (input == null || (typeof input !== "string" && !(input instanceof Blob))) {
      throw new InvalidPayloadError("sanitize() input must be a string, File, or Blob.");
    }
    if (typeof input === "string") {
      const payload: SanitizeRequest = { content: input };
      if (config !== undefined) payload.config = config;
      if (metadata !== undefined) payload.metadata = metadata;
      return JSON.stringify(payload);
    }

    const filename = input instanceof File ? input.name : "upload.bin";
    const arrayBuffer = await input.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Spread (...bytes) crashes on large files (stack overflow at ~65k args).
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const payload: SanitizeRequest = { filename, file_base64: base64 };
    if (config !== undefined) payload.config = config;
    if (metadata !== undefined) payload.metadata = metadata;
    return JSON.stringify(payload);
  }

  private async post(body: BodyInit): Promise<SanitizeSuccess> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/sanitize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`SentrySafety request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    let json: SanitizeResponse;
    try {
      json = (await response.json()) as SanitizeResponse;
    } catch {
      throw buildError(
        "engine_error",
        `Server returned non-JSON response (HTTP ${response.status})`
      );
    }

    if (json.status === "error") {
      throw buildError(json.error, json.message);
    }

    return json;
  }
}
