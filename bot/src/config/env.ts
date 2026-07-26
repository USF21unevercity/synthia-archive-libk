import "dotenv/config";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface AppConfig {
  botToken: string;
  databaseUrl: string;
  ownerId: number;
  archiveChannelId: string;
  logLevel: LogLevel;
}

class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

let cached: AppConfig | null = null;

/** Loads configuration exclusively from environment variables. Nothing is hardcoded. */
export function loadConfig(): AppConfig {
  if (cached) return cached;

  const ownerRaw = required("OWNER_ID");
  const ownerId = Number.parseInt(ownerRaw, 10);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
    throw new ConfigError(`OWNER_ID must be a positive numeric Telegram id, received: ${ownerRaw}`);
  }

  const logLevel = optional("LOG_LEVEL", "info") as LogLevel;
  if (!["error", "warn", "info", "debug"].includes(logLevel)) {
    throw new ConfigError(`LOG_LEVEL must be one of error|warn|info|debug, received: ${logLevel}`);
  }

  cached = {
    botToken: required("BOT_TOKEN"),
    databaseUrl: required("DATABASE_URL"),
    ownerId,
    archiveChannelId: required("ARCHIVE_CHANNEL_ID"),
    logLevel,
  };

  return cached;
}
