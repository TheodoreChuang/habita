import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { z } from 'zod';

export interface TelegramConfig {
  botToken: string;
}

export const MessageSchema = z.object({
  id: z.string(),
  chatId: z.number(),
  text: z.string(),
  userId: z.number(),
  userName: z.string().optional(),
  command: z.string().optional(),
  timestamp: z.date(),
});

export type ParsedMessage = z.infer<typeof MessageSchema>;

export class TelegramService {
  private bot: Telegraf<Context>;

  constructor(config: TelegramConfig) {
    this.bot = new Telegraf(config.botToken);
    this.setupErrorHandler();
    this.setupMessageHandler();
    this.setupGracefulShutdown();
  }

  private setupErrorHandler() {
    this.bot.catch((err) => {
      console.error('Telegraf error:', err);
    });
  }

  private setupMessageHandler() {
    this.bot.on('text', (ctx) => {
      const parsedMessage = this.convertMessageToParsedMessage(ctx.message);
      if (parsedMessage) {
        // Process the parsed message as needed
        console.log('Received message:', parsedMessage);
      }
    });
  }

  private setupGracefulShutdown() {
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private extractCommand(text: string): string | undefined {
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].substring(1);
      return command;
    }
    return undefined;
  }

  private convertMessageToParsedMessage(message: Message.TextMessage): ParsedMessage | null {
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
      console.error('Error parsing message:', error);
      return null;
    }
  }

  async sendMessage(chatId: number, text: string): Promise<boolean> {
    try {
      await this.bot.telegram.sendMessage(chatId, text);
      return true;
    } catch (error) {
      console.error('Send error:', error);
      return false;
    }
  }

  start() {
    this.bot.launch();
  }
}
