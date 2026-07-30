import type { LogLevel } from "../config/env.js";

const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const REDACTED_KEYS = [
  "bot_token",
  "bottoken",
  "token",
  "database_url",
  "databaseurl",
  "password",
  "authorization",
  "cookie",
  "secret",
];

function redact(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.includes(key.toLowerCase()) ? "***" : redact(val);
    }
    return out;
  }
  return value;
}

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

export function createLogger(level: LogLevel, scope = "app"): Logger {
  const threshold = LEVELS[level];

  const write = (lvl: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (LEVELS[lvl] > threshold) return;
    const line = {
      ts: new Date().toISOString(),
      level: lvl,
      scope,
      message,
      ...(meta ? { meta: redact(meta) } : {}),
    };
    const serialized = JSON.stringify(line);
    if (lvl === "error") console.error(serialized);
    else if (lvl === "warn") console.warn(serialized);
    else console.log(serialized);
  };

  return {
    error: (m, meta) => write("error", m, meta),
    warn: (m, meta) => write("warn", m, meta),
    info: (m, meta) => write("info", m, meta),
    debug: (m, meta) => write("debug", m, meta),
    child: (childScope: string) => createLogger(level, `${scope}:${childScope}`),
  };
}
