import type { Database } from "../db/pool.js";

export class SettingsRepository {
  constructor(private readonly pool: Database) {}

  async get(key: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = $1",
      [key],
    );
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value],
    );
  }

  async all(): Promise<Record<string, string>> {
    const { rows } = await this.pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM settings ORDER BY key",
    );
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
