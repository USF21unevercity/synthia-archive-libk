import type { Logger } from "../../core/logger.js";
import { AppError, toAppError } from "../../core/errors.js";
import type { PermissionService } from "../../services/permission.service.js";
import type { ArchiveService } from "../../services/archive.service.js";
import type { ActivityLogRepository } from "../../infrastructure/repositories/activity-log.repository.js";
import type { TelegramClient, TelegramUpdate } from "../client.js";
import type { CommandDefinition } from "./types.js";

/**
 * Module 1 — Telegram Core.
 * Routes updates to channel archiving or to a command; contains no business logic itself.
 */
export class UpdateDispatcher {
  private readonly commands: Map<string, CommandDefinition>;

  constructor(
    commands: CommandDefinition[],
    private readonly permissions: PermissionService,
    private readonly archive: ArchiveService,
    private readonly activity: ActivityLogRepository,
    private readonly telegram: TelegramClient,
    private readonly logger: Logger,
  ) {
    this.commands = new Map(commands.map((c) => [c.name, c]));
  }

  async dispatch(update: TelegramUpdate): Promise<void> {
    const channelPost = update.channel_post ?? update.edited_channel_post;
    if (channelPost) {
      await this.archive.handleChannelPost(channelPost);
      return;
    }

    const message = update.message;
    if (!message?.from || !message.text) return;

    const text = message.text.trim();
    if (!text.startsWith("/")) return;

    const [rawCommand, ...rest] = text.split(/\s+/);
    const name = rawCommand!.slice(1).split("@")[0]!.toLowerCase();
    const command = this.commands.get(name);
    const reply = (body: string) => this.telegram.sendMessage(message.chat.id, body);

    if (!command) {
      await reply("أمر غير معروف. أرسل /help لعرض الأوامر.");
      return;
    }

    const actor = await this.permissions.resolve(String(message.from.id));
    if (!actor) {
      this.logger.warn("Unauthorized command attempt", {
        userId: message.from.id,
        command: name,
      });
      await reply("غير مصرح لك باستخدام هذه المنصة.");
      return;
    }

    try {
      await command.handler({ message, actor, args: rest.join(" ").trim(), reply });
      await this.activity.record({
        actorTelegramId: actor.telegramUserId,
        action: `command.${name}`,
        entityType: "command",
      });
    } catch (error) {
      const appError = toAppError(error);
      this.logger.error("Command failed", {
        command: name,
        code: appError.code,
        error: appError.message,
      });
      await this.activity
        .record({
          actorTelegramId: actor.telegramUserId,
          action: `command.${name}.failed`,
          entityType: "command",
          details: { code: appError.code },
        })
        .catch(() => undefined);
      await reply(appError instanceof AppError ? appError.userMessage : "حدث خطأ غير متوقع.");
    }
  }
}
