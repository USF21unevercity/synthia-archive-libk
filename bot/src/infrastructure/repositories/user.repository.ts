import type { Database } from "../db/pool.js";

/** Bot users (students included). Additive table — no existing schema touched. */
export class UserRepository {
  constructor(private readonly pool: Database) {}

  async touch(input: {
    telegramUserId: string;
    fullName?: string | null;
    username?: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO bot_users (telegram_user_id, full_name, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_user_id) DO UPDATE
         SET full_name = COALESCE(EXCLUDED.full_name, bot_users.full_name),
             username  = COALESCE(EXCLUDED.username, bot_users.username),
             last_seen_at = NOW()`,
      [input.telegramUserId, input.fullName ?? null, input.username ?? null],
    );
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>("SELECT COUNT(*) FROM bot_users");
    return Number(rows[0]?.count ?? 0);
  }

  async countActiveSince(since: Date): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM bot_users WHERE last_seen_at >= $1",
      [since],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
