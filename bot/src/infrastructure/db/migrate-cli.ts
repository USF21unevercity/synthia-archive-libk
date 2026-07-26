import { loadConfig } from "../../config/env.js";
import { createLogger } from "../../core/logger.js";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrator.js";

const config = loadConfig();
const logger = createLogger(config.logLevel, "migrate");
const pool = createPool(config.databaseUrl, logger);

try {
  await runMigrations(pool, logger);
} catch (error) {
  logger.error("Migration failed", { error: error instanceof Error ? error.message : error });
  process.exitCode = 1;
} finally {
  await pool.end();
}
