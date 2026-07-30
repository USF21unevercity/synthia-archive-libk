import type { Logger } from "../core/logger.js";
import { TelegramApiError, toAppError } from "../core/errors.js";
import type { TelegramClient, TelegramUpdate } from "./client.js";

export type UpdateHandler = (update: TelegramUpdate) => Promise<void>;

/**
 * Long-polling loop with graceful recovery: a failing update never stops the bot,
 * and transport errors back off instead of crashing the process.
 */
export class UpdatePoller {
  private offset = 0;
  private running = false;
  private backoffMs = 1_000;

  constructor(
    private readonly client: TelegramClient,
    private readonly handler: UpdateHandler,
    private readonly logger: Logger,
  ) {}

  stop(): void {
    this.running = false;
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn("Update poller already running");
      return;
    }

    this.running = true;
    this.logger.info("Update poller started");

    while (this.running) {
      try {
        const updates = await this.client.getUpdates(this.offset);
        this.backoffMs = 1_000;

        for (const update of updates) {
          this.offset = update.update_id + 1;
          try {
            await this.handler(update);
          } catch (error) {
            const appError = toAppError(error);
            this.logger.error("Update handling failed", {
              updateId: update.update_id,
              code: appError.code,
              error: appError.message,
            });
          }
        }
      } catch (error) {
        const appError = toAppError(error);
        await this.recoverPollingMode(error);
        this.logger.error("Polling failed, backing off", {
          code: appError.code,
          error: appError.message,
          backoffMs: this.backoffMs,
        });
        await new Promise((resolve) => setTimeout(resolve, this.backoffMs));
        this.backoffMs = Math.min(this.backoffMs * 2, 60_000);
      }
    }

    this.logger.info("Update poller stopped");
  }

  private async recoverPollingMode(error: unknown): Promise<void> {
    if (!(error instanceof TelegramApiError)) return;
    if (error.method !== "getUpdates") return;
    if (!error.description.toLowerCase().includes("webhook")) return;

    try {
      this.logger.warn("Telegram webhook is blocking polling; deleting webhook without dropping updates");
      await this.client.deleteWebhook(false);
      this.backoffMs = 1_000;
    } catch (deleteError) {
      const appError = toAppError(deleteError);
      this.logger.error("Failed to delete blocking Telegram webhook", { error: appError.message });
    }
  }
}
