import { loadConfig } from "../config/env.js";
import { createLogger } from "../core/logger.js";
import { createPool } from "../infrastructure/db/pool.js";
import { TelegramClient } from "../telegram/client.js";
import { toAppError } from "../core/errors.js";

/**
 * Pre-flight verification: configuration, PostgreSQL, schema and Telegram.
 * Run with `npm run verify`. Exits non-zero if any check fails,
 * which makes it usable as a deployment gate in CI/CD.
 */
const EXPECTED_TABLES = [
  "channels",
  "admins",
  "admin_channels",
  "files",
  "archive_logs",
  "hashtags",
  "file_hashtags",
  "settings",
  "activity_logs",
  "schema_migrations",
];

async function main(): Promise<number> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel, "verify");
  logger.info("Configuration loaded", {
    ownerId: config.ownerId,
    archiveChannelId: config.archiveChannelId,
    port: config.port,
  });

  let failures = 0;
  const pool = createPool(config.databaseUrl, logger);

  try {
    const started = Date.now();
    const { rows } = await pool.query<{ version: string }>("SELECT version() AS version");
    logger.info("PostgreSQL connected", {
      latencyMs: Date.now() - started,
      version: rows[0]?.version?.split(",")[0],
    });

    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const present = new Set(tables.rows.map((r) => r.table_name));
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
    if (missing.length > 0) {
      failures += 1;
      logger.error("Missing tables — run `npm run migrate`", { missing });
    } else {
      logger.info("Database schema verified", { tables: EXPECTED_TABLES.length });
    }

    const applied = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    logger.info("Applied migrations", { migrations: applied.rows.map((r) => r.name) });
  } catch (error) {
    failures += 1;
    logger.error("PostgreSQL verification failed", { error: toAppError(error).message });
  } finally {
    await pool.end().catch(() => undefined);
  }

  try {
    const telegram = new TelegramClient(config.botToken, logger.child("telegram"));
    const me = await telegram.getMe();
    logger.info("Telegram bot connected", { id: me.id, username: me.username });
  } catch (error) {
    failures += 1;
    logger.error("Telegram verification failed", { error: toAppError(error).message });
  }

  if (failures === 0) logger.info("All checks passed — project ready");
  else logger.error("Verification finished with failures", { failures });

  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error(JSON.stringify({ level: "error", message: toAppError(error).message }));
    process.exit(1);
  });
