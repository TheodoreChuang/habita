import { EventEmitter } from "events";
import { JsonObject } from "@prisma/client/runtime/library";

import { ConversationState, StateContext } from "../types/states";
import { DatabaseService } from "./database";
import { GroqService } from "./groq";
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
  private stateHandlers: Map<ConversationState, BaseStateHandler>;
  private groqService: GroqService;

  constructor(private db: DatabaseService) {
    super();
    this.stateHandlers = new Map();
    this.groqService = new GroqService();

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

  // Main method to process incoming messages
  async handleMessage(message: ParsedMessage): Promise<void> {
    try {
      if (!message.internalUserId) {
        throw new Error("Internal user ID is required");
      }

      // Create context for current state
      const context: StateContext = {
        userId: message.internalUserId, // Use the internal UUID
        chatId: message.chatId,
        currentState: await this.getCurrentState(message.internalUserId),
        stateData: await this.getUserStateData(message.internalUserId),
      };

      // Get handler for current state
      const handler = this.stateHandlers.get(context.currentState);
      let responseText = "";

      if (handler) {
        // Process message with handler
        const result = await handler.handleMessage(message, context);

        // Update state if changed
        if (result.nextState !== context.currentState) {
          await this.db.updateUserState(
            message.internalUserId,
            result.nextState,
            result.stateData
          );
        }
        responseText = result.response;
      } else {
        // If no handler exists, use GroqService to generate a response
        responseText = await this.groqService.generateResponse([
          { role: "system", content: "You are a helpful health coach." },
          { role: "user", content: message.text },
        ]);
      }

      // Emit state transition event
      this.emit("stateTransition", {
        userId: message.internalUserId,
        fromState: context.currentState,
        toState: context.currentState, // FIXME? // result.nextState,
        message: responseText,
        chatId: message.chatId,
      });
    } catch (error) {
      console.error("Error in conversation manager:", error);
      this.emit("error", error);
    }
  }

  // Helper to get current state
  async getCurrentState(userId: string): Promise<ConversationState> {
    const user = await this.db.getUser(userId);
    return (
      (user?.currentState as ConversationState) ||
      ConversationState.INITIAL_DISCOVERY
    );
  }

  // Helper to get user data
  async getUserStateData(userId: string): Promise<JsonObject> {
    const user = await this.db.getUser(userId);
    return (user?.stateData as JsonObject) || {};
  }
}
