import { PrismaClient } from '@prisma/client';
import { ParsedMessage } from './telegram';
import { ConversationState } from '../types/states';

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
        currentState: ConversationState.INITIAL_DISCOVERY,
        stateData: {}
      }
    });
  }

  async updateUserState(
    userId: string, 
    state: ConversationState, 
    stateData?: Record<string, any>
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        currentState: state,
        stateData: stateData || {}
      }
    });
  }

  async getUser(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId }
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


  async disconnect() {
    await this.prisma.$disconnect();
  }
}