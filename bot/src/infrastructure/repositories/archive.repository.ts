import type { Database } from "../db/pool.js";

export class ArchiveRepository {
  constructor(private readonly pool: Database) {}

  async record(input: {
    fileId: number;
    archiveChannelId: string;
    archiveMessageId?: number | null;
    status: "pending" | "archived" | "failed";
    errorMessage?: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO archive_logs (file_id, archive_channel_id, archive_message_id, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.fileId,
        input.archiveChannelId,
        input.archiveMessageId ?? null,
        input.status,
        input.errorMessage ?? null,
      ],
    );
  }

  async stats(): Promise<{ archived: number; failed: number; pending: number }> {
    const { rows } = await this.pool.query<{ status: string; total: string }>(
      "SELECT status, COUNT(*) AS total FROM archive_logs GROUP BY status",
    );
    const result = { archived: 0, failed: 0, pending: 0 };
    for (const row of rows) {
      if (row.status in result) result[row.status as keyof typeof result] = Number(row.total);
    }
    return result;
  }
}
