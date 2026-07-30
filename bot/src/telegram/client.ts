import { TelegramApiError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";
import { isNetworkLikeError, withRetry } from "../core/retry.js";

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  document?: TelegramDocument;
  photo?: Array<{ file_id: string; file_unique_id: string; file_size?: number }>;
  video?: TelegramDocument & { duration?: number };
  audio?: TelegramDocument;
  voice?: TelegramDocument;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}
/** Thin, dependency-free Telegram Bot API client. The token never leaves this module. */
export class TelegramClient {
  private readonly baseUrl: string;
  private readonly timeoutMs = 40_000;

  constructor(
    token: string,
    private readonly logger: Logger,
  ) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
    return withRetry(() => this.callOnce<T>(method, payload), {
      attempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 5_000,
      shouldRetry: (error) => isRetryableTelegramError(error),
      onRetry: (error, attempt, delayMs) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn("Retrying Telegram API call", { method, attempt, delayMs, error: message });
      },
    });
  }

  private async callOnce<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => ({
        ok: false,
        description: `HTTP ${response.status}`,
      }))) as { ok: boolean; result?: T; description?: string; error_code?: number };

      if (!response.ok || !body.ok) {
        this.logger.error("Telegram API call failed", {
          method,
          status: response.status,
          description: body.description,
        });
        throw new TelegramApiError(method, body.description ?? `HTTP ${response.status}`, body.error_code);
      }
      return body.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  getMe() {
    return this.call<TelegramUser>("getMe");
  }

  sendMessage(chatId: string | number, text: string, extra: Record<string, unknown> = {}) {
    return this.call<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    });
  }

  copyMessage(toChatId: string | number, fromChatId: string | number, messageId: number) {
    return this.call<{ message_id: number }>("copyMessage", {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
  }

  getUpdates(offset: number, timeout = 30) {
    return this.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout,
      allowed_updates: [
  "message",
  "channel_post",
  "edited_channel_post",
  "callback_query",
],
  }

  deleteWebhook(dropPendingUpdates = false) {
    return this.call<boolean>("deleteWebhook", { drop_pending_updates: dropPendingUpdates });
  }

  getWebhookInfo() {
    return this.call<TelegramWebhookInfo>("getWebhookInfo");
  }
}

function isRetryableTelegramError(error: unknown): boolean {
  if (isNetworkLikeError(error)) return true;
  if (!(error instanceof TelegramApiError)) return false;
  if (error.errorCode === 429 || (error.errorCode && error.errorCode >= 500)) return true;
  return false;
}
