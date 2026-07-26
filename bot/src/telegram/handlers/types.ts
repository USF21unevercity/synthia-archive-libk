import type { Actor } from "../../services/permission.service.js";
import type { TelegramMessage } from "../client.js";

export interface CommandContext {
  message: TelegramMessage;
  actor: Actor;
  args: string;
  reply: (text: string) => Promise<unknown>;
}

export interface CommandDefinition {
  name: string;
  description: string;
  handler: (ctx: CommandContext) => Promise<void>;
}
