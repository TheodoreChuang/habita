import { Telegraf, Context } from "telegraf";
import { Message } from "telegraf/typings/core/types/typegram";
import { z } from "zod";
import { EventEmitter } from "events";

import { DatabaseService } from "./database";

export interface TelegramConfig {
  botToken: string;
}

export const MessageSchema = z.object({
  id: z.string(),
  chatId: z.number(),
  text: z.string(),
  userId: z.number(), // This is the Telegram user ID
  userName: z.string().optional(),
  command: z.string().optional(),
  timestamp: z.date(),
  internalUserId: z.string().optional(), // Add this for the internal UUID
});

export type ParsedMessage = z.infer<typeof MessageSchema>;
// Define events that TelegramService can emit
export enum TelegramEvents {
  MESSAGE_RECEIVED = "messageReceived",
  ERROR = "error",
}

export class TelegramService extends EventEmitter {
  private bot: Telegraf<Context>;
  private db: DatabaseService;

  constructor(config: TelegramConfig, db: DatabaseService) {
    super();
    this.bot = new Telegraf(config.botToken);
    this.db = db;
    this.setupErrorHandler();
    this.setupMessageHandler();
    this.setupGracefulShutdown();
  }

  private setupErrorHandler() {
    this.bot.catch((err) => {
      console.error("Telegraf error:", err);
      this.emit(TelegramEvents.ERROR, err);
    });
  }

  private async setupMessageHandler() {
    this.bot.on("text", async (ctx) => {
      const parsedMessage = this.convertMessageToParsedMessage(ctx.message);
      if (parsedMessage) {
        try {
          // Ensure user exists in database
          const user = await this.db.createUser(
            BigInt(parsedMessage.userId),
            BigInt(parsedMessage.chatId),
            parsedMessage.userName
          );

          // Store message in conversation
          await this.db.storeMessage(user.id, parsedMessage);

          // Emit message for other handlers
          this.emit(TelegramEvents.MESSAGE_RECEIVED, {
            ...parsedMessage,
            internalUserId: user.id,
          });
        } catch (error) {
          console.error("Error handling message:", error);
          this.emit(TelegramEvents.ERROR, error);
        }
      }
    });
  }

  private setupGracefulShutdown() {
    process.once("SIGINT", () => {
      this.bot.stop("SIGINT");
      this.db.disconnect();
    });
    process.once("SIGTERM", () => {
      this.bot.stop("SIGTERM");
      this.db.disconnect();
    });
  }

  private extractCommand(text: string): string | undefined {
    if (text.startsWith("/")) {
      const command = text.split(" ")[0].substring(1);
      return command;
    }
    return undefined;
  }

  private convertMessageToParsedMessage(
    message: Message.TextMessage
  ): ParsedMessage | null {
    try {
      return MessageSchema.parse({
        id: String(message.message_id),
        chatId: message.chat.id,
        text: message.text,
        userId: message.from?.id,
        userName: message.from?.username,
        command: this.extractCommand(message.text),
        timestamp: new Date(message.date * 1000),
      });
    } catch (error) {
      console.error("Error parsing message:", error);
      return null;
    }
  }

  async sendMessage(chatId: number, text: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
      return true;
    } catch (error) {
      console.error("Send error:", error);
      return false;
    }
  }

  start() {
    this.bot.launch();
    console.log("Telegram bot started and listening for messages...");
  }
}
