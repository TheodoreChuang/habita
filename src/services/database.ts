import { PrismaClient } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";

import { ConversationState } from "../types/states";
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
        currentState: ConversationState.INITIAL_DISCOVERY,
        stateData: {},
      },
    });
  }

  async updateUserState(
    userId: string,
    state: ConversationState,
    stateData?: JsonValue
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        currentState: state,
        stateData: stateData || {},
      },
    });
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
        messages: [message],
      },
    });
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
