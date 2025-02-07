import { PrismaClient } from '@prisma/client';

import { ParsedMessage } from './telegram';

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
        currentState: 'initial_discovery'
      }
    });
  }

  async storeMessage(userId: string, message: ParsedMessage) {
    return this.prisma.conversation.create({
      data: {
        userId,
        state: 'active',
        messages: [message]
      }
    });
  }

  async getUser(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId }
    });
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}