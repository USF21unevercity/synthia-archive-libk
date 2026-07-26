import type { ChannelRepository } from "../infrastructure/repositories/channel.repository.js";
import type { FileRepository } from "../infrastructure/repositories/file.repository.js";
import type { ArchiveRepository } from "../infrastructure/repositories/archive.repository.js";
import type { HashtagRepository } from "../infrastructure/repositories/hashtag.repository.js";
import type { ContentType } from "../domain/models.js";

export interface PlatformStatistics {
  channels: number;
  files: number;
  today: number;
  week: number;
  month: number;
  byType: Array<{ contentType: ContentType; total: number }>;
  archive: { archived: number; failed: number; pending: number };
  topHashtags: Array<{ tag: string; usageCount: number }>;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Module 10 — Statistics. */
export class StatisticsService {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly files: FileRepository,
    private readonly archive: ArchiveRepository,
    private readonly hashtags: HashtagRepository,
  ) {}

  async overview(): Promise<PlatformStatistics> {
    const [channels, files, today, week, month, byType, archive, topHashtags] = await Promise.all([
      this.channels.count(),
      this.files.countAll(),
      this.files.countSince(daysAgo(1)),
      this.files.countSince(daysAgo(7)),
      this.files.countSince(daysAgo(30)),
      this.files.countByContentType(),
      this.archive.stats(),
      this.hashtags.top(10),
    ]);

    return { channels, files, today, week, month, byType, archive, topHashtags };
  }
}
