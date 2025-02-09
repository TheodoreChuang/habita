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
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    // Extract messages from all conversations
    const messages = conversations.map((conversation) => ({
      role: (
        conversation.message as { role: ChatCompletionMessageParam["role"] }
      ).role,
      content: `${conversation.createdAt}: ${
        (conversation.message as { text: string }).text
      }`,
    }));

    return messages;
  }

  async getUser(userId?: string) {
    if (!userId) return null;

    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async storeMessage(userId: string, message: ParsedMessage) {
    return this.prisma.conversation.create({
      data: {
        userId,
        state: "active",
        message: message,
      },
    });
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
