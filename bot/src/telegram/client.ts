import { TelegramApiError } from "../core/errors.js";
import type { Logger } from "../core/logger.js";

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
}

/** Thin, dependency-free Telegram Bot API client. The token never leaves this module. */
export class TelegramClient {
  private readonly baseUrl: string;

  constructor(
    token: string,
    private readonly logger: Logger,
  ) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
    if (!response.ok || !body.ok) {
      this.logger.error("Telegram API call failed", {
        method,
        status: response.status,
        description: body.description,
      });
      throw new TelegramApiError(method, body.description ?? `HTTP ${response.status}`, body.error_code);
    }
    return body.result as T;
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
      allowed_updates: ["message", "channel_post", "edited_channel_post"],
    });
  }
}
