import pg from "pg";
import type { Logger } from "../../core/logger.js";
import { isNetworkLikeError, withRetry } from "../../core/retry.js";

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
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  pool.on("error", (err) => {
    logger.error("Unexpected PostgreSQL pool error", { error: err.message });
  });

  const retryable = (error: unknown) => isTransientPostgresError(error) || isNetworkLikeError(error);
  const onRetry = (error: unknown, attempt: number, delayMs: number) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("Retrying PostgreSQL operation", { attempt, delayMs, error: message });
  };

  const originalQuery = pool.query.bind(pool) as (...args: unknown[]) => Promise<pg.QueryResult>;
  (pool as unknown as { query: (...args: unknown[]) => Promise<pg.QueryResult> }).query = (...args) =>
    withRetry(() => originalQuery(...args), {
      attempts: 3,
      initialDelayMs: 300,
      maxDelayMs: 2_000,
      shouldRetry: retryable,
      onRetry,
    });

  const originalConnect = pool.connect.bind(pool) as () => Promise<pg.PoolClient>;
  (pool as unknown as { connect: () => Promise<pg.PoolClient> }).connect = () =>
    withRetry(() => originalConnect(), {
      attempts: 3,
      initialDelayMs: 300,
      maxDelayMs: 2_000,
      shouldRetry: retryable,
      onRetry,
    });

  return pool;
}

function isTransientPostgresError(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  if (["08000", "08003", "08006", "57P01", "57P02", "57P03", "53300"].includes(code)) {
    return true;
  }

  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return [
    "terminating connection",
    "connection terminated unexpectedly",
    "client has encountered a connection error",
    "connection timeout",
    "database system is starting up",
    "database system is shutting down",
  ].some((needle) => message.includes(needle));
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
