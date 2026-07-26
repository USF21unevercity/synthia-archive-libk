import type { Database } from "../db/pool.js";
import type { Admin, AdminRole } from "../../domain/models.js";

interface AdminRow {
  id: string;
  telegram_user_id: string;
  full_name: string | null;
  username: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: Date;
}

function map(row: AdminRow): Admin {
  return {
    id: Number(row.id),
    telegramUserId: row.telegram_user_id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export class AdminRepository {
  constructor(private readonly pool: Database) {}

  async upsert(input: {
    telegramUserId: string;
    fullName?: string | null;
    username?: string | null;
    role?: AdminRole;
  }): Promise<Admin> {
    const { rows } = await this.pool.query<AdminRow>(
      `INSERT INTO admins (telegram_user_id, full_name, username, role)
       VALUES ($1, $2, $3, COALESCE($4, 'admin'))
       ON CONFLICT (telegram_user_id) DO UPDATE
         SET full_name = COALESCE(EXCLUDED.full_name, admins.full_name),
             username  = COALESCE(EXCLUDED.username, admins.username),
             role      = COALESCE($4, admins.role),
             is_active = TRUE
       RETURNING *`,
      [input.telegramUserId, input.fullName ?? null, input.username ?? null, input.role ?? null],
    );
    return map(rows[0]!);
  }

  async findByTelegramId(telegramUserId: string): Promise<Admin | null> {
    const { rows } = await this.pool.query<AdminRow>(
      "SELECT * FROM admins WHERE telegram_user_id = $1",
      [telegramUserId],
    );
    return rows[0] ? map(rows[0]) : null;
  }

  async list(): Promise<Admin[]> {
    const { rows } = await this.pool.query<AdminRow>(
      "SELECT * FROM admins ORDER BY role, created_at",
    );
    return rows.map(map);
  }

  /** Owner rows are protected: deactivation is refused at the service layer. */
  async setActive(telegramUserId: string, isActive: boolean): Promise<void> {
    await this.pool.query(
      "UPDATE admins SET is_active = $2 WHERE telegram_user_id = $1 AND role <> 'owner'",
      [telegramUserId, isActive],
    );
  }

  async assignChannel(adminId: number, channelId: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_channels (admin_id, channel_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminId, channelId],
    );
  }

  async unassignChannel(adminId: number, channelId: number): Promise<void> {
    await this.pool.query("DELETE FROM admin_channels WHERE admin_id = $1 AND channel_id = $2", [
      adminId,
      channelId,
    ]);
  }

  async hasChannel(adminId: number, channelId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "SELECT 1 FROM admin_channels WHERE admin_id = $1 AND channel_id = $2",
      [adminId, channelId],
    );
    return (rowCount ?? 0) > 0;
  }
}
