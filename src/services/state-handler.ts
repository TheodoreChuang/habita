import { ParsedMessage } from './telegram';
import { ConversationState, StateContext, StateTransitionResult } from '../types/states';
import { DatabaseService } from './database';

export abstract class BaseStateHandler {
  constructor(protected db: DatabaseService) {}

  abstract handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult>;

  protected async updateUserState(
    userId: string,
    state: ConversationState
  ): Promise<void> {
    await this.db.updateUserState(userId, state);
  }
}