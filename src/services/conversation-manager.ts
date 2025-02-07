import { EventEmitter } from "events";

import { ConversationState, StateContext } from "../types/states";
import { DatabaseService } from "./database";
import { ParsedMessage } from "./telegram";
import {
  BaseStateHandler,
  InitialDiscoveryHandler,
  GoalSettingHandler,
  ActionPlanningHandler,
  ActiveCoachingHandler,
  ProgressReviewHandler,
} from "./state-handler";

export class ConversationManager extends EventEmitter {
  // Map to store state handlers
  private stateHandlers: Map<ConversationState, BaseStateHandler>;

  constructor(private db: DatabaseService) {
    super();
    this.stateHandlers = new Map();

    this.stateHandlers.set(
      ConversationState.INITIAL_DISCOVERY,
      new InitialDiscoveryHandler(db)
    );
    this.stateHandlers.set(
      ConversationState.GOAL_SETTING,
      new GoalSettingHandler(db)
    );
    this.stateHandlers.set(
      ConversationState.ACTION_PLANNING,
      new ActionPlanningHandler(db)
    );
    this.stateHandlers.set(
      ConversationState.ACTIVE_COACHING,
      new ActiveCoachingHandler(db)
    );
    this.stateHandlers.set(
      ConversationState.PROGRESS_REVIEW,
      new ProgressReviewHandler(db)
    );
  }

  // Method to register handlers for different states
  registerHandler(state: ConversationState, handler: BaseStateHandler) {
    this.stateHandlers.set(state, handler);
  }

  // Main method to process incoming messages
  async handleMessage(message: ParsedMessage): Promise<void> {
    try {
      // Get user from database
      const user = await this.db.getUser(BigInt(message.userId));
      if (!user) {
        throw new Error("User not found");
      }

      // Create context for current state
      const context: StateContext = {
        userId: user.id,
        chatId: message.chatId,
        currentState:
          (user.currentState as ConversationState) ||
          ConversationState.INITIAL_DISCOVERY,
        stateData: user.stateData,
      };

      // Get handler for current state
      const handler = this.stateHandlers.get(context.currentState);
      if (!handler) {
        throw new Error(`No handler found for state: ${context.currentState}`);
      }

      // Process message with handler
      const result = await handler.handleMessage(message, context);

      // Update state if changed
      if (result.nextState !== context.currentState) {
        await this.db.updateUserState(
          user.id,
          result.nextState,
          result.stateData
        );
      }

      // Emit state transition event
      this.emit("stateTransition", {
        userId: user.id,
        fromState: context.currentState,
        toState: result.nextState,
        message: result.response,
      });
    } catch (error) {
      console.error("Error in conversation manager:", error);
      this.emit("error", error);
    }
  }

  // Helper to get current state
  async getCurrentState(userId: string): Promise<ConversationState> {
    const user = await this.db.getUser(BigInt(userId));
    return (
      (user?.currentState as ConversationState) ||
      ConversationState.INITIAL_DISCOVERY
    );
  }
}
