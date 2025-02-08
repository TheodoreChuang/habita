import { EventEmitter } from "events";

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

    // Register handlers
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

  async handleMessage(message: ParsedMessage): Promise<void> {
    if (!message.internalUserId) {
      throw new Error("Internal user ID is required");
    }

    try {
      const user = await this.db.getUser(message.internalUserId);
      if (!user) {
        throw new Error("User not found");
      }

      const context: StateContext = {
        userId: message.internalUserId,
        chatId: message.chatId,
        currentState:
          (user.currentState as ConversationState) ||
          ConversationState.INITIAL_DISCOVERY,
        stateData: user.stateData,
      };

      const handler = this.stateHandlers.get(context.currentState);
      let responseText = "";

      if (handler) {
        const result = await handler.handleMessage(message, context);
        if (result.nextState !== context.currentState) {
          await this.db.updateUserState(
            message.internalUserId,
            result.nextState,
            result.stateData
          );
        }
        responseText = result.response;
      }

      // If no predefined response or user input is unexpected, use Groq
      if (!responseText || message.text.toLowerCase() === "ask ai") {
        responseText = await this.groqService.generateResponse([
          { role: "system", content: "You are a helpful health coach." },
          { role: "user", content: message.text },
        ]);
      }

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
}
