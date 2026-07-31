import type { ChannelRepository } from "../infrastructure/repositories/channel.repository.js";
import type { FileRepository } from "../infrastructure/repositories/file.repository.js";
import type { ArchiveRepository } from "../infrastructure/repositories/archive.repository.js";
import type { HashtagRepository } from "../infrastructure/repositories/hashtag.repository.js";
import type { AdminRepository } from "../infrastructure/repositories/admin.repository.js";
import type { UserRepository } from "../infrastructure/repositories/user.repository.js";
import type { ViewRepository } from "../infrastructure/repositories/view.repository.js";
import type { ContentType } from "../domain/models.js";

export interface PlatformStatistics {
  channels: number;
  files: number;
  users: number;
  activeUsers: number;
  admins: number;
  views: number;
  today: number;
  week: number;
  month: number;
  byType: Array<{ contentType: ContentType; total: number }>;
  topColleges: Array<{ value: string; total: number }>;
  topSubjects: Array<{ value: string; total: number }>;
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
    private readonly admins: AdminRepository,
    private readonly users: UserRepository,
    private readonly views: ViewRepository,
  ) {}

  async overview(): Promise<PlatformStatistics> {
    const [
      channels,
      files,
      users,
      activeUsers,
      adminList,
      views,
      today,
      week,
      month,
      byType,
      topColleges,
      topSubjects,
      archive,
      topHashtags,
    ] = await Promise.all([
      this.channels.count(),
      this.files.countAll(),
      this.users.count(),
      this.users.countActiveSince(daysAgo(7)),
      this.admins.list(),
      this.views.total(),
      this.files.countSince(daysAgo(1)),
      this.files.countSince(daysAgo(7)),
      this.files.countSince(daysAgo(30)),
      this.files.countByContentType(),
      this.files.distinctValues("category", 5),
      this.files.distinctValues("subject", 5),
      this.archive.stats(),
      this.hashtags.top(10),
    ]);

    return {
      channels,
      files,
      users,
      activeUsers,
      admins: adminList.filter((a) => a.isActive).length,
      views,
      today,
      week,
      month,
      byType,
      topColleges,
      topSubjects,
      archive,
      topHashtags,
    };
  }
}
