import pg from "pg";
import type { Logger } from "../../core/logger.js";

export type Database = pg.Pool;

export interface QueryRunner {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>>;
}

/** Creates the external PostgreSQL pool. Only DATABASE_URL is used. */
export function createPool(databaseUrl: string, logger: Logger): Database {
  const needsSsl = !/localhost|127\.0\.0\.1/.test(databaseUrl);
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  pool.on("error", (err) => {
    logger.error("Unexpected PostgreSQL pool error", { error: err.message });
  });

  return pool;
}

/** Runs a callback inside a transaction, rolling back on any failure. */
export async function withTransaction<T>(
  pool: Database,
  fn: (client: QueryRunner) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
