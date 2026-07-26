import type { Database } from "../db/pool.js";
import type { ActivityLog } from "../../domain/models.js";

export class ActivityLogRepository {
  constructor(private readonly pool: Database) {}

  async record(input: {
    actorTelegramId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    details?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO activity_logs (actor_telegram_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.actorTelegramId ?? null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.details ? JSON.stringify(input.details) : null,
      ],
    );
  }

  async recent(limit = 20): Promise<ActivityLog[]> {
    const { rows } = await this.pool.query<{
      id: string;
      actor_telegram_id: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      details: Record<string, unknown> | null;
      created_at: Date;
    }>("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1", [limit]);

    return rows.map((r) => ({
      id: Number(r.id),
      actorTelegramId: r.actor_telegram_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
      createdAt: r.created_at,
    }));
  }
}
