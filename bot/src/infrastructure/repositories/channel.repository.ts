import type { Database } from "../db/pool.js";
import type { Channel, ChannelStatus } from "../../domain/models.js";

interface ChannelRow {
  id: string;
  telegram_channel_id: string;
  title: string;
  username: string | null;
  archive_channel_id: string | null;
  status: ChannelStatus;
  created_at: Date;
  updated_at: Date;
}

function map(row: ChannelRow): Channel {
  return {
    id: Number(row.id),
    telegramChannelId: row.telegram_channel_id,
    title: row.title,
    username: row.username,
    archiveChannelId: row.archive_channel_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ChannelRepository {
  constructor(private readonly pool: Database) {}

  async create(input: {
    telegramChannelId: string;
    title: string;
    username?: string | null;
    archiveChannelId?: string | null;
  }): Promise<Channel> {
    const { rows } = await this.pool.query<ChannelRow>(
      `INSERT INTO channels (telegram_channel_id, title, username, archive_channel_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (telegram_channel_id) DO UPDATE
         SET title = EXCLUDED.title,
             username = EXCLUDED.username,
             archive_channel_id = COALESCE(EXCLUDED.archive_channel_id, channels.archive_channel_id),
             updated_at = NOW()
       RETURNING *`,
      [input.telegramChannelId, input.title, input.username ?? null, input.archiveChannelId ?? null],
    );
    return map(rows[0]!);
  }

  async findByTelegramId(telegramChannelId: string): Promise<Channel | null> {
    const { rows } = await this.pool.query<ChannelRow>(
      "SELECT * FROM channels WHERE telegram_channel_id = $1",
      [telegramChannelId],
    );
    return rows[0] ? map(rows[0]) : null;
  }

  async findById(id: number): Promise<Channel | null> {
    const { rows } = await this.pool.query<ChannelRow>("SELECT * FROM channels WHERE id = $1", [id]);
    return rows[0] ? map(rows[0]) : null;
  }

  async list(limit = 50, offset = 0): Promise<Channel[]> {
    const { rows } = await this.pool.query<ChannelRow>(
      "SELECT * FROM channels ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    );
    return rows.map(map);
  }

  async listForAdmin(adminId: number): Promise<Channel[]> {
    const { rows } = await this.pool.query<ChannelRow>(
      `SELECT c.* FROM channels c
       JOIN admin_channels ac ON ac.channel_id = c.id
       WHERE ac.admin_id = $1
       ORDER BY c.title`,
      [adminId],
    );
    return rows.map(map);
  }

  async setStatus(id: number, status: ChannelStatus): Promise<void> {
    await this.pool.query("UPDATE channels SET status = $2, updated_at = NOW() WHERE id = $1", [
      id,
      status,
    ]);
  }

  async setArchiveChannel(id: number, archiveChannelId: string): Promise<void> {
    await this.pool.query(
      "UPDATE channels SET archive_channel_id = $2, updated_at = NOW() WHERE id = $1",
      [id, archiveChannelId],
    );
  }

  async remove(id: number): Promise<void> {
    await this.pool.query("DELETE FROM channels WHERE id = $1", [id]);
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>("SELECT COUNT(*) FROM channels");
    return Number(rows[0]?.count ?? 0);
  }
}
