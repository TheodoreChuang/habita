import { JsonObject } from "@prisma/client/runtime/library";

import { ParsedMessage } from "./telegram";
import {
  ConversationState,
  StateContext,
  StateTransitionResult,
} from "../types/states";
import { DatabaseService } from "./database";

// Base class that all state handlers must extend
export abstract class BaseStateHandler {
  constructor(protected db: DatabaseService) {}

  // Abstract method that each state handler must implement
  abstract handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult>;

  // Helper method to update user state in database
  protected async updateUserState(
    userId: string,
    state: ConversationState
  ): Promise<void> {
    await this.db.updateUserState(userId, state);
  }
}

// Example of a concrete state handler
export class InitialDiscoveryHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    const stateData = (context.stateData as JsonObject) || {};
    if (stateData?.hasAskedName) {
      return {
        nextState: ConversationState.INITIAL_DISCOVERY,
        response: "Hi! What's your name?",
        stateData: { hasAskedName: true },
      };
    }

    // If we're waiting for the name
    if (stateData?.hasAskedName && stateData?.name) {
      return {
        nextState: ConversationState.INITIAL_DISCOVERY,
        response: `Nice to meet you, ${message.text}! What are your main health goals?`,
        stateData: {
          ...stateData,
          name: message.text,
          hasAskedGoals: true,
        },
      };
    }

    // Move to goal setting when ready
    return {
      nextState: ConversationState.GOAL_SETTING,
      response: "Great! Let's set some specific goals.",
      stateData: {
        ...stateData,
        initialGoals: message.text,
      },
    };
  }
}

export class GoalSettingHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    // Ensure stateData is treated as an object
    const stateData = (context.stateData as JsonObject) || {};

    if (!stateData.goalCategory) {
      return {
        nextState: ConversationState.GOAL_SETTING,
        response:
          "What area of your health would you like to improve? (e.g., sleep, diet, exercise, stress)",
        stateData: { ...stateData, goalCategory: message.text },
      };
    }

    return {
      nextState: ConversationState.ACTION_PLANNING,
      response: `Got it! Let's define specific actions to improve your ${stateData.goalCategory}.`,
    };
  }
}

export class ActionPlanningHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.ACTIVE_COACHING,
      response:
        "Great! I’ll remind you to take this action regularly. Let's check in on your progress soon!",
    };
  }
}

export class ActiveCoachingHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.PROGRESS_REVIEW,
      response: "How are you feeling about your progress so far?",
    };
  }
}

export class ProgressReviewHandler extends BaseStateHandler {
  async handleMessage(
    message: ParsedMessage,
    context: StateContext
  ): Promise<StateTransitionResult> {
    return {
      nextState: ConversationState.GOAL_SETTING,
      response: "Would you like to set a new goal or adjust your current plan?",
    };
  }
}
