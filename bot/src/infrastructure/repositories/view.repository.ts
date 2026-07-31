import type { Database } from "../db/pool.js";

/** File view tracking — powers "الأكثر مشاهدة". Additive table. */
export class ViewRepository {
  constructor(private readonly pool: Database) {}

  async record(fileId: number, viewerTelegramId: string | null): Promise<void> {
    await this.pool.query(
      "INSERT INTO file_views (file_id, viewer_telegram_id) VALUES ($1, $2)",
      [fileId, viewerTelegramId],
    );
  }

  async countForFile(fileId: number): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM file_views WHERE file_id = $1",
      [fileId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async topFileIds(limit = 10): Promise<Array<{ fileId: number; views: number }>> {
    const { rows } = await this.pool.query<{ file_id: string; views: string }>(
      `SELECT file_id, COUNT(*) AS views
         FROM file_views
        GROUP BY file_id
        ORDER BY views DESC
        LIMIT $1`,
      [Math.min(limit, 50)],
    );
    return rows.map((r) => ({ fileId: Number(r.file_id), views: Number(r.views) }));
  }

  async total(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>("SELECT COUNT(*) FROM file_views");
    return Number(rows[0]?.count ?? 0);
  }
}
