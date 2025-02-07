import { ParsedMessage } from './telegram';
import { 
  ConversationState, 
  StateContext, 
} from '../types/states';
import { DatabaseService } from './database';
import { BaseStateHandler } from './state-handler';
import { EventEmitter } from 'events';

export class ConversationManager extends EventEmitter {
  private stateHandlers: Map<ConversationState, BaseStateHandler>;

  constructor(private db: DatabaseService) {
    super();
    this.stateHandlers = new Map();
  }

  registerHandler(state: ConversationState, handler: BaseStateHandler) {
    this.stateHandlers.set(state, handler);
  }

  async handleMessage(message: ParsedMessage): Promise<void> {
    try {
      // Get or create user state context
      const user = await this.db.getUser(BigInt(message.userId));
      if (!user) {
        throw new Error('User not found');
      }

      const context: StateContext = {
        userId: user.id,
        chatId: message.chatId,
        currentState: (user.currentState as ConversationState) || ConversationState.INITIAL_DISCOVERY,
        stateData: user.stateData
      };

      // Get appropriate handler for current state
      const handler = this.stateHandlers.get(context.currentState);
      if (!handler) {
        throw new Error(`No handler found for state: ${context.currentState}`);
      }

      // Process message with handler
      const result = await handler.handleMessage(message, context);

      // Update user state if changed
      if (result.nextState !== context.currentState) {
        await this.db.updateUserState(user.id, result.nextState, result.stateData);
      }

      // Emit state transition event
      this.emit('stateTransition', {
        userId: user.id,
        fromState: context.currentState,
        toState: result.nextState,
        message: result.response
      });

    } catch (error) {
      console.error('Error in conversation manager:', error);
      this.emit('error', error);
    }
  }

  async getCurrentState(userId: string): Promise<ConversationState> {
    const user = await this.db.getUser(BigInt(userId));
    return (user?.currentState as ConversationState) || ConversationState.INITIAL_DISCOVERY;
  }
}
