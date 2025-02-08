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
    this.groqService = new GroqService(db);

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
      const initialState =
        (user.currentState as ConversationState) ||
        ConversationState.INITIAL_DISCOVERY;

      let context: StateContext = {
        userId: message.internalUserId,
        chatId: message.chatId,
        currentState: initialState,
        stateData: user.stateData || {},
      };

      const handler = this.stateHandlers.get(context.currentState);
      let responseText = "";

      if (handler) {
        // Use the LLM to validate the user's input
        const validationResponse = await this.groqService.validateInput(
          context.userId,
          message.text,
          context.currentState
        );

        if (validationResponse.isValid) {
          const result = await handler.handleMessage(message, context);
          if (result.nextState !== context.currentState || result.stateData) {
            context = {
              ...context,
              currentState: result.nextState,
              stateData: result.stateData || context.stateData,
            };
            await this.db.updateUserState(
              message.internalUserId,
              result.nextState,
              context.stateData
            );
          }
          responseText = result.response;

          this.db.storeMessage(context.userId, {
            ...message,
            role: "assistance",
            userName: "Habita",
            text: result.response,
          });
        } else {
          // If the input is invalid, use the LLM's suggested response
          responseText = validationResponse.feedback;
        }
      }

      // Emit the state transition with the response
      this.emit("stateTransition", {
        userId: message.internalUserId,
        fromState: initialState,
        toState: context.currentState,
        message: responseText,
        chatId: message.chatId,
      });
    } catch (error) {
      console.error("Error in conversation manager:", error);
      this.emit("error", error);
    }
  }
}
