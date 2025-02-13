import { PrismaClient } from "@prisma/client";

import { ChatCompletionMessageParam } from "./groq";
import { ParsedMessage } from "./telegram";

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createUser(telegramId: bigint, chatId: bigint, username?: string) {
    return this.prisma.user.upsert({
      where: { telegramId },
      update: { chatId, username },
      create: {
        telegramId,
        chatId,
        username,
      },
    });
  }

  async getConversationMessages(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    const parsedMessages = messages.map((msg) => ({
      role: (
        msg.message as { role: ChatCompletionMessageParam["role"] }
      ).role,
      content: `${msg.createdAt}: ${
        (msg.message as { text: string }).text
      }`,
    }));

    return parsedMessages;
  }

  async getUser(userId?: string) {
    if (!userId) return null;

    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async storeMessage(userId: string, message: ParsedMessage) {
    return this.prisma.message.create({
      data: {
        userId,
        message: message,
      },
    });
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
