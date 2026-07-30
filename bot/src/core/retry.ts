import { toAppError } from "./errors.js";

export interface RetryOptions {
  attempts: number;
  initialDelayMs: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isNetworkLikeError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  if (
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "EPIPE",
      "ENOTFOUND",
      "EAI_AGAIN",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
      "UND_ERR_BODY_TIMEOUT",
      "UND_ERR_SOCKET",
    ].includes(code)
  ) {
    return true;
  }

  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return [
    "network",
    "fetch failed",
    "timeout",
    "socket hang up",
    "connection terminated",
    "connection reset",
    "connection refused",
  ].some((needle) => message.includes(needle));
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const factor = options.factor ?? 2;
  let delayMs = options.initialDelayMs;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const canRetry = attempt < attempts && (options.shouldRetry?.(error, attempt) ?? true);
      if (!canRetry) throw error;

      options.onRetry?.(error, attempt, delayMs);
      await delay(delayMs);
      delayMs = Math.min(Math.round(delayMs * factor), options.maxDelayMs ?? delayMs * factor);
    }
  }

  throw toAppError(new Error("Retry attempts exhausted"));
}