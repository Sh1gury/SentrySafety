import type { SanitizeErrorCode } from "@/types/scan";

export class SentrySafetyError extends Error {
  readonly code: SanitizeErrorCode;
  readonly httpStatus: number;

  constructor(code: SanitizeErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "SentrySafetyError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class InvalidPayloadError extends SentrySafetyError {
  constructor(message: string) {
    super("invalid_payload", message, 400);
    this.name = "InvalidPayloadError";
  }
}

export class EncryptedArchiveError extends SentrySafetyError {
  constructor(message: string) {
    super("encrypted_archive", message, 400);
    this.name = "EncryptedArchiveError";
  }
}

export class PayloadTooLargeError extends SentrySafetyError {
  constructor(message: string) {
    super("payload_too_large", message, 413);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends SentrySafetyError {
  constructor(message: string) {
    super("unsupported_media_type", message, 415);
    this.name = "UnsupportedMediaTypeError";
  }
}

export class RateLimitedError extends SentrySafetyError {
  constructor(message: string) {
    super("rate_limited", message, 429);
    this.name = "RateLimitedError";
  }
}

export class EngineError extends SentrySafetyError {
  constructor(message: string) {
    super("engine_error", message, 500);
    this.name = "EngineError";
  }
}

export class ModelUnavailableError extends SentrySafetyError {
  constructor(message: string) {
    super("model_unavailable", message, 502);
    this.name = "ModelUnavailableError";
  }
}

const ERROR_CONSTRUCTORS: Record<
  SanitizeErrorCode,
  new (message: string) => SentrySafetyError
> = {
  invalid_payload: InvalidPayloadError,
  encrypted_archive: EncryptedArchiveError,
  payload_too_large: PayloadTooLargeError,
  unsupported_media_type: UnsupportedMediaTypeError,
  rate_limited: RateLimitedError,
  engine_error: EngineError,
  model_unavailable: ModelUnavailableError,
};

export function buildError(
  code: SanitizeErrorCode,
  message: string
): SentrySafetyError {
  const Ctor = ERROR_CONSTRUCTORS[code];
  return Ctor ? new Ctor(message) : new SentrySafetyError(code, message, 500);
}
