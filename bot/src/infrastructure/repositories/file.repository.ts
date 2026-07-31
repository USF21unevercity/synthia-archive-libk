import type { Database } from "../db/pool.js";
import type { ContentType, ScientificFile } from "../../domain/models.js";

interface FileRow {
  id: string;
  channel_id: string;
  message_id: string;
  telegram_file_id: string | null;
  telegram_file_unique_id: string | null;
  content_type: ContentType;
  title: string | null;
  caption: string | null;
  subject: string | null;
  category: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: string | null;
  link_url: string | null;
  published_at: Date;
  created_at: Date;
}

function map(row: FileRow): ScientificFile {
  return {
    id: Number(row.id),
    channelId: Number(row.channel_id),
    messageId: Number(row.message_id),
    telegramFileId: row.telegram_file_id,
    telegramFileUniqueId: row.telegram_file_unique_id,
    contentType: row.content_type,
    title: row.title,
    caption: row.caption,
    subject: row.subject,
    category: row.category,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    linkUrl: row.link_url,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export interface CreateFileInput {
  channelId: number;
  messageId: number;
  telegramFileId?: string | null;
  telegramFileUniqueId?: string | null;
  contentType: ContentType;
  title?: string | null;
  caption?: string | null;
  subject?: string | null;
  category?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  linkUrl?: string | null;
  publishedAt: Date;
}

export interface SearchCriteria {
  text?: string;
  contentType?: ContentType;
  channelId?: number;
  subject?: string;
  category?: string;
  hashtag?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export class FileRepository {
  constructor(private readonly pool: Database) {}

  /** Returns null when the message or file identity is already archived (duplicate guard). */
  async create(input: CreateFileInput): Promise<ScientificFile | null> {
    const { rows } = await this.pool.query<FileRow>(
      `INSERT INTO files (channel_id, message_id, telegram_file_id, telegram_file_unique_id,
                          content_type, title, caption, subject, category, file_name,
                          mime_type, file_size, link_url, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        input.channelId,
        input.messageId,
        input.telegramFileId ?? null,
        input.telegramFileUniqueId ?? null,
        input.contentType,
        input.title ?? null,
        input.caption ?? null,
        input.subject ?? null,
        input.category ?? null,
        input.fileName ?? null,
        input.mimeType ?? null,
        input.fileSize ?? null,
        input.linkUrl ?? null,
        input.publishedAt,
      ],
    );
    return rows[0] ? map(rows[0]) : null;
  }

  async findById(id: number): Promise<ScientificFile | null> {
    const { rows } = await this.pool.query<FileRow>("SELECT * FROM files WHERE id = $1", [id]);
    return rows[0] ? map(rows[0]) : null;
  }

  async search(criteria: SearchCriteria): Promise<ScientificFile[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace("$?", `$${params.length}`));
    };

    if (criteria.text) {
      add(
        `to_tsvector('simple',
            COALESCE(f.title,'') || ' ' || COALESCE(f.caption,'') || ' ' ||
            COALESCE(f.subject,'') || ' ' || COALESCE(f.category,'') || ' ' ||
            COALESCE(f.file_name,'')) @@ plainto_tsquery('simple', $?)`,
        criteria.text,
      );
    }
    if (criteria.contentType) add("f.content_type = $?", criteria.contentType);
    if (criteria.channelId) add("f.channel_id = $?", criteria.channelId);
    if (criteria.subject) add("f.subject ILIKE '%' || $? || '%'", criteria.subject);
    if (criteria.category) add("f.category ILIKE '%' || $? || '%'", criteria.category);
    if (criteria.from) add("f.published_at >= $?", criteria.from);
    if (criteria.to) add("f.published_at <= $?", criteria.to);
    if (criteria.hashtag) {
      add(
        `EXISTS (SELECT 1 FROM file_hashtags fh
                 JOIN hashtags h ON h.id = fh.hashtag_id
                 WHERE fh.file_id = f.id AND h.tag = $?)`,
        criteria.hashtag.replace(/^#/, "").toLowerCase(),
      );
    }

    params.push(Math.min(criteria.limit ?? 20, 100));
    const limitIdx = params.length;
    params.push(criteria.offset ?? 0);
    const offsetIdx = params.length;

    const { rows } = await this.pool.query<FileRow>(
      `SELECT f.* FROM files f
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY f.published_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return rows.map(map);
  }

  async countByContentType(): Promise<Array<{ contentType: ContentType; total: number }>> {
    const { rows } = await this.pool.query<{ content_type: ContentType; total: string }>(
      "SELECT content_type, COUNT(*) AS total FROM files GROUP BY content_type ORDER BY total DESC",
    );
    return rows.map((r) => ({ contentType: r.content_type, total: Number(r.total) }));
  }

  async countAll(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>("SELECT COUNT(*) FROM files");
    return Number(rows[0]?.count ?? 0);
  }

  async countSince(since: Date): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM files WHERE published_at >= $1",
      [since],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async latest(limit = 10, channelIds?: number[]): Promise<ScientificFile[]> {
    const useFilter = Array.isArray(channelIds) && channelIds.length > 0;
    const { rows } = await this.pool.query<FileRow>(
      `SELECT * FROM files
       ${useFilter ? "WHERE channel_id = ANY($2::bigint[])" : ""}
       ORDER BY published_at DESC LIMIT $1`,
      useFilter ? [Math.min(limit, 50), channelIds] : [Math.min(limit, 50)],
    );
    return rows.map(map);
  }

  async findByIds(ids: number[]): Promise<ScientificFile[]> {
    if (!ids.length) return [];
    const { rows } = await this.pool.query<FileRow>(
      "SELECT * FROM files WHERE id = ANY($1::bigint[])",
      [ids],
    );
    return rows.map(map);
  }

  async distinctValues(field: "subject" | "category", limit = 40): Promise<
    Array<{ value: string; total: number }>
  > {
    const column = field === "subject" ? "subject" : "category";
    const { rows } = await this.pool.query<{ value: string; total: string }>(
      `SELECT ${column} AS value, COUNT(*) AS total
         FROM files
        WHERE ${column} IS NOT NULL AND ${column} <> ''
        GROUP BY ${column}
        ORDER BY total DESC, value
        LIMIT $1`,
      [Math.min(limit, 100)],
    );
    return rows.map((r) => ({ value: r.value, total: Number(r.total) }));
  }

  async countByChannel(): Promise<Array<{ channelId: number; total: number }>> {
    const { rows } = await this.pool.query<{ channel_id: string; total: string }>(
      "SELECT channel_id, COUNT(*) AS total FROM files GROUP BY channel_id ORDER BY total DESC",
    );
    return rows.map((r) => ({ channelId: Number(r.channel_id), total: Number(r.total) }));
  }
}

