import type { Database } from "../db/pool.js";

export class HashtagRepository {
  constructor(private readonly pool: Database) {}

  async attach(fileId: number, tags: string[]): Promise<void> {
    for (const raw of tags) {
      const tag = raw.replace(/^#/, "").trim().toLowerCase();
      if (!tag) continue;
      const { rows } = await this.pool.query<{ id: string }>(
        `INSERT INTO hashtags (tag, usage_count) VALUES ($1, 1)
         ON CONFLICT (tag) DO UPDATE SET usage_count = hashtags.usage_count + 1
         RETURNING id`,
        [tag],
      );
      const hashtagId = rows[0]?.id;
      if (!hashtagId) continue;
      await this.pool.query(
        "INSERT INTO file_hashtags (file_id, hashtag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [fileId, hashtagId],
      );
    }
  }

  async top(limit = 20): Promise<Array<{ tag: string; usageCount: number }>> {
    const { rows } = await this.pool.query<{ tag: string; usage_count: string }>(
      "SELECT tag, usage_count FROM hashtags ORDER BY usage_count DESC, tag LIMIT $1",
      [limit],
    );
    return rows.map((r) => ({ tag: r.tag, usageCount: Number(r.usage_count) }));
  }

  async forFile(fileId: number): Promise<string[]> {
    const { rows } = await this.pool.query<{ tag: string }>(
      `SELECT h.tag FROM hashtags h
       JOIN file_hashtags fh ON fh.hashtag_id = h.id
       WHERE fh.file_id = $1 ORDER BY h.tag`,
      [fileId],
    );
    return rows.map((r) => r.tag);
  }
}
