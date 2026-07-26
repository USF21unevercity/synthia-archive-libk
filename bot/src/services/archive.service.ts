import type { Logger } from "../core/logger.js";
import { toAppError } from "../core/errors.js";
import type { ChannelRepository } from "../infrastructure/repositories/channel.repository.js";
import type { FileRepository } from "../infrastructure/repositories/file.repository.js";
import type { HashtagRepository } from "../infrastructure/repositories/hashtag.repository.js";
import type { ArchiveRepository } from "../infrastructure/repositories/archive.repository.js";
import type { ActivityLogRepository } from "../infrastructure/repositories/activity-log.repository.js";
import type { ContentExtractionService } from "./content-extraction.service.js";
import type { TelegramClient, TelegramMessage } from "../telegram/client.js";

/**
 * Module 6 — Archive System.
 * Detects a new post in a registered channel, persists metadata + hashtags,
 * copies it to the archive channel and records the archive log.
 */
export class ArchiveService {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly files: FileRepository,
    private readonly hashtags: HashtagRepository,
    private readonly archive: ArchiveRepository,
    private readonly activity: ActivityLogRepository,
    private readonly extractor: ContentExtractionService,
    private readonly telegram: TelegramClient,
    private readonly defaultArchiveChannelId: string,
    private readonly logger: Logger,
  ) {}

  async handleChannelPost(message: TelegramMessage): Promise<void> {
    const telegramChannelId = String(message.chat.id);
    const channel = await this.channels.findByTelegramId(telegramChannelId);

    if (!channel) {
      this.logger.debug("Post from unregistered channel ignored", { telegramChannelId });
      return;
    }
    if (channel.status !== "active") {
      this.logger.debug("Post from inactive channel ignored", { channelId: channel.id });
      return;
    }

    const content = this.extractor.extract(message);

    const file = await this.files.create({
      channelId: channel.id,
      messageId: message.message_id,
      telegramFileId: content.telegramFileId,
      telegramFileUniqueId: content.telegramFileUniqueId,
      contentType: content.contentType,
      title: content.title,
      caption: content.caption,
      fileName: content.fileName,
      mimeType: content.mimeType,
      fileSize: content.fileSize,
      linkUrl: content.linkUrl,
      publishedAt: new Date(message.date * 1000),
    });

    if (!file) {
      this.logger.info("Duplicate post skipped", {
        channelId: channel.id,
        messageId: message.message_id,
      });
      return;
    }

    await this.hashtags.attach(file.id, content.hashtags);

    const archiveChannelId = channel.archiveChannelId ?? this.defaultArchiveChannelId;
    try {
      const copied = await this.telegram.copyMessage(
        archiveChannelId,
        telegramChannelId,
        message.message_id,
      );
      await this.archive.record({
        fileId: file.id,
        archiveChannelId,
        archiveMessageId: copied.message_id,
        status: "archived",
      });
    } catch (error) {
      const appError = toAppError(error);
      await this.archive.record({
        fileId: file.id,
        archiveChannelId,
        status: "failed",
        errorMessage: appError.message,
      });
      this.logger.error("Archiving failed", { fileId: file.id, error: appError.message });
    }

    await this.activity.record({
      action: "file.archived",
      entityType: "file",
      entityId: String(file.id),
      details: { contentType: content.contentType, channelId: channel.id },
    });
  }
}
