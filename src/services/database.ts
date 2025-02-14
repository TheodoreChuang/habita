import { PrismaClient, Message, User } from "@prisma/client";

import { ParsedMessage } from "./telegram";

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createUser(
    telegramId: bigint,
    chatId: bigint,
    username?: string
  ): Promise<User> {
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

  async getMessages({
    userId,
    limit,
    orderBy,
  }: {
    userId: string;
    limit?: number;
    orderBy?: "asc" | "desc";
  }): Promise<Message[]> {
    return await this.prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: orderBy ?? "desc" },
      take: limit,
    });
  }

  async getUser(userId?: string): Promise<User | null> {
    if (!userId) return null;

    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async storeMessage(userId: string, message: ParsedMessage): Promise<Message> {
    return this.prisma.message.create({
      data: {
        userId,
        message: message,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
