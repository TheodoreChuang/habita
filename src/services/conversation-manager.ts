import { EventEmitter } from 'events';

import { 
  ConversationState, 
  StateContext, 
  StateTransitionResult 
} from '../types/states';
import { ParsedMessage } from './telegram';
import { DatabaseService } from './database';
import { BaseStateHandler,
InitialDiscoveryHandler,
    GoalSettingHandler, 
    ActionPlanningHandler, 
    ActiveCoachingHandler, 
    ProgressReviewHandler 
 } from './state-handler';

export class ConversationManager extends EventEmitter {
  private stateHandlers: Map<ConversationState, BaseStateHandler>;

  constructor(private db: DatabaseService) {
    super();
    this.stateHandlers = new Map();
    
    this.stateHandlers.set(ConversationState.INITIAL_DISCOVERY, new InitialDiscoveryHandler(db));
    this.stateHandlers.set(ConversationState.GOAL_SETTING, new GoalSettingHandler(db));
    this.stateHandlers.set(ConversationState.ACTION_PLANNING, new ActionPlanningHandler(db));
    this.stateHandlers.set(ConversationState.ACTIVE_COACHING, new ActiveCoachingHandler(db));
    this.stateHandlers.set(ConversationState.PROGRESS_REVIEW, new ProgressReviewHandler(db));
  }

  async handleMessage(message: ParsedMessage): Promise<void> {
    try {
      const user = await this.db.getUser(BigInt(message.userId));
      if (!user) {
        throw new Error('User not found');
      }

      const context: StateContext = {
        userId: user.id,
        chatId: message.chatId,
        currentState: (user.currentState as ConversationState) || ConversationState.GOAL_SETTING,
        stateData: user.stateData
      };

      const handler = this.stateHandlers.get(context.currentState);
      if (!handler) {
        throw new Error(`No handler found for state: ${context.currentState}`);
      }

      const result: StateTransitionResult = await handler.handleMessage(message, context);
      
      if (result.nextState !== context.currentState) {
        await this.db.updateUserState(user.id, result.nextState, result.stateData);
      }
      
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
}
