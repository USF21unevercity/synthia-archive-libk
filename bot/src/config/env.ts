import "dotenv/config";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface AppConfig {
  botToken: string;
  databaseUrl: string;
  ownerId: number;
  archiveChannelId: string;
  logLevel: LogLevel;
  port: number;
  /** Public HTTPS base URL. When set, the bot runs in webhook mode instead of long polling. */
  webhookUrl: string;
  /** Path the Telegram servers will POST updates to. */
  webhookPath: string;
  /** Secret token verified on every incoming webhook request. */
  webhookSecret: string;
  mode: "webhook" | "polling";
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

  const portRaw = optional("PORT", "8080");
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new ConfigError(`PORT must be a valid TCP port, received: ${portRaw}`);
  }

  cached = {
    botToken: required("BOT_TOKEN"),
    databaseUrl: required("DATABASE_URL"),
    ownerId,
    // Optional: when empty, archiving is deferred until a channel is configured.
    archiveChannelId: optional("ARCHIVE_CHANNEL_ID", ""),
    logLevel,
    port,
  };


  return cached;
}
